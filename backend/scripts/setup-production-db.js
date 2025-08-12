#!/usr/bin/env node

/**
 * Production Database Setup Script
 *
 * This script sets up the production Supabase database with:
 * - Tables and indexes
 * - Row Level Security policies
 * - Database functions
 * - Performance optimizations
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.production' });

// Initialize Supabase client with service role key
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🚀 Setting up production database...');

async function setupDatabase() {
  try {
    // 1. Create tables
    await createTables();

    // 2. Create indexes
    await createIndexes();

    // 3. Create functions
    await createFunctions();

    // 4. Enable RLS and create policies
    await setupSecurityPolicies();

    // 5. Insert initial data
    await insertInitialData();

    console.log('✅ Production database setup completed successfully!');
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  }
}

async function createTables() {
  console.log('📋 Creating tables...');

  // Users table
  const { error: usersError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'staff', 'admin')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `,
  });

  if (usersError) {
    console.error('Error creating users table:', usersError);
    throw usersError;
  }

  // Cafe tables table
  const { error: tablesError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS cafe_tables (
        id SERIAL PRIMARY KEY,
        table_number INTEGER UNIQUE NOT NULL,
        capacity INTEGER NOT NULL CHECK (capacity > 0),
        status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'maintenance')),
        location TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `,
  });

  if (tablesError) {
    console.error('Error creating cafe_tables table:', tablesError);
    throw tablesError;
  }

  // Reservations table
  const { error: reservationsError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS reservations (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        table_id INTEGER REFERENCES cafe_tables(id) ON DELETE CASCADE NOT NULL,
        reservation_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        party_size INTEGER NOT NULL CHECK (party_size > 0),
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT valid_time_range CHECK (start_time < end_time),
        CONSTRAINT valid_party_size CHECK (party_size <= (SELECT capacity FROM cafe_tables WHERE id = table_id))
      );
    `,
  });

  if (reservationsError) {
    console.error('Error creating reservations table:', reservationsError);
    throw reservationsError;
  }

  // Reservation conflicts table
  const { error: conflictsError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS reservation_conflicts (
        id SERIAL PRIMARY KEY,
        reservation_id INTEGER REFERENCES reservations(id) ON DELETE CASCADE,
        conflict_type TEXT NOT NULL,
        conflict_details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `,
  });

  if (conflictsError) {
    console.error(
      'Error creating reservation_conflicts table:',
      conflictsError
    );
    throw conflictsError;
  }

  console.log('✅ Tables created successfully');
}

async function createIndexes() {
  console.log('🔍 Creating indexes...');

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);',
    'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);',
    'CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_reservations_table_id ON reservations(table_id);',
    'CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(reservation_date);',
    'CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);',
    'CREATE INDEX IF NOT EXISTS idx_reservations_date_time ON reservations(reservation_date, start_time, end_time);',
    'CREATE INDEX IF NOT EXISTS idx_cafe_tables_status ON cafe_tables(status);',
    'CREATE INDEX IF NOT EXISTS idx_cafe_tables_capacity ON cafe_tables(capacity);',
    'CREATE INDEX IF NOT EXISTS idx_conflicts_reservation_id ON reservation_conflicts(reservation_id);',
  ];

  for (const index of indexes) {
    const { error } = await supabase.rpc('exec_sql', { sql: index });
    if (error) {
      console.error('Error creating index:', error);
      throw error;
    }
  }

  console.log('✅ Indexes created successfully');
}

async function createFunctions() {
  console.log('⚙️ Creating functions...');

  // Check table availability function
  const { error: availabilityError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE OR REPLACE FUNCTION check_table_availability(
        p_table_id INTEGER,
        p_reservation_date DATE,
        p_start_time TIME,
        p_end_time TIME,
        p_exclude_reservation_id INTEGER DEFAULT NULL
      )
      RETURNS BOOLEAN AS $$
      DECLARE
        conflicting_count INTEGER;
      BEGIN
        SELECT COUNT(*)
        INTO conflicting_count
        FROM reservations
        WHERE table_id = p_table_id
          AND reservation_date = p_reservation_date
          AND status != 'cancelled'
          AND (
            (start_time < p_end_time AND end_time > p_start_time)
            OR (p_start_time < end_time AND p_end_time > start_time)
          )
          AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id);
        
        RETURN conflicting_count = 0;
      END;
      $$ LANGUAGE plpgsql;
    `,
  });

  if (availabilityError) {
    console.error('Error creating availability function:', availabilityError);
    throw availabilityError;
  }

  // Safe reservation creation function
  const { error: createError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE OR REPLACE FUNCTION create_reservation_safe(
        p_user_id UUID,
        p_table_id INTEGER,
        p_reservation_date DATE,
        p_start_time TIME,
        p_end_time TIME,
        p_party_size INTEGER,
        p_notes TEXT DEFAULT NULL
      )
      RETURNS JSON AS $$
      DECLARE
        table_capacity INTEGER;
        is_available BOOLEAN;
        new_reservation_id INTEGER;
        result JSON;
      BEGIN
        -- Check if table exists and get capacity
        SELECT capacity INTO table_capacity
        FROM cafe_tables
        WHERE id = p_table_id AND status = 'available';
        
        IF NOT FOUND THEN
          RETURN json_build_object('success', false, 'error', 'Table not found or not available');
        END IF;
        
        -- Check party size
        IF p_party_size > table_capacity THEN
          RETURN json_build_object('success', false, 'error', 'Party size exceeds table capacity');
        END IF;
        
        -- Check availability
        SELECT check_table_availability(p_table_id, p_reservation_date, p_start_time, p_end_time)
        INTO is_available;
        
        IF NOT is_available THEN
          RETURN json_build_object('success', false, 'error', 'Table not available for selected time');
        END IF;
        
        -- Create reservation
        INSERT INTO reservations (user_id, table_id, reservation_date, start_time, end_time, party_size, notes)
        VALUES (p_user_id, p_table_id, p_reservation_date, p_start_time, p_end_time, p_party_size, p_notes)
        RETURNING id INTO new_reservation_id;
        
        RETURN json_build_object(
          'success', true,
          'reservation_id', new_reservation_id,
          'message', 'Reservation created successfully'
        );
      END;
      $$ LANGUAGE plpgsql;
    `,
  });

  if (createError) {
    console.error('Error creating reservation function:', createError);
    throw createError;
  }

  console.log('✅ Functions created successfully');
}

async function setupSecurityPolicies() {
  console.log('🔒 Setting up security policies...');

  // Enable RLS on all tables
  const tables = [
    'users',
    'cafe_tables',
    'reservations',
    'reservation_conflicts',
  ];

  for (const table of tables) {
    const { error } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,
    });

    if (error) {
      console.error(`Error enabling RLS on ${table}:`, error);
      throw error;
    }
  }

  // Create policies
  const policies = [
    // Users policies
    `CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);`,
    `CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);`,
    `CREATE POLICY "Only admins can manage users" ON users FOR ALL USING (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );`,

    // Cafe tables policies
    `CREATE POLICY "Anyone can view tables" ON cafe_tables FOR SELECT USING (true);`,
    `CREATE POLICY "Only admins can manage tables" ON cafe_tables FOR ALL USING (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );`,

    // Reservations policies
    `CREATE POLICY "Users can view own reservations" ON reservations FOR SELECT USING (auth.uid() = user_id);`,
    `CREATE POLICY "Users can create reservations" ON reservations FOR INSERT WITH CHECK (auth.uid() = user_id);`,
    `CREATE POLICY "Users can update own reservations" ON reservations FOR UPDATE USING (auth.uid() = user_id);`,
    `CREATE POLICY "Staff can view all reservations" ON reservations FOR SELECT USING (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('staff', 'admin'))
    );`,
    `CREATE POLICY "Staff can update all reservations" ON reservations FOR UPDATE USING (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('staff', 'admin'))
    );`,

    // Conflicts policies
    `CREATE POLICY "Staff can view conflicts" ON reservation_conflicts FOR SELECT USING (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('staff', 'admin'))
    );`,
  ];

  for (const policy of policies) {
    const { error } = await supabase.rpc('exec_sql', { sql: policy });
    if (error && !error.message.includes('already exists')) {
      console.error('Error creating policy:', error);
      throw error;
    }
  }

  console.log('✅ Security policies created successfully');
}

async function insertInitialData() {
  console.log('📊 Inserting initial data...');

  // Insert sample tables
  const { error: tablesError } = await supabase.from('cafe_tables').upsert(
    [
      { table_number: 1, capacity: 2, status: 'available', location: 'Window' },
      { table_number: 2, capacity: 4, status: 'available', location: 'Center' },
      { table_number: 3, capacity: 6, status: 'available', location: 'Garden' },
      { table_number: 4, capacity: 2, status: 'available', location: 'Bar' },
      {
        table_number: 5,
        capacity: 8,
        status: 'available',
        location: 'Private',
      },
    ],
    { onConflict: 'table_number' }
  );

  if (tablesError) {
    console.error('Error inserting tables:', tablesError);
    throw tablesError;
  }

  console.log('✅ Initial data inserted successfully');
}

// Run the setup
setupDatabase().catch(console.error);
