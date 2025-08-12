const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAdminUser() {
  try {
    console.log('Creating admin user...');

    // Create user in Supabase Auth
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email: 'admin@cafe.com',
        password: 'admin123',
        email_confirm: true,
        user_metadata: {
          name: 'Admin User',
          role: 'admin',
        },
      });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return;
    }

    console.log('Auth user created:', authUser.user.id);

    // Create user profile in users table
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        email: 'admin@cafe.com',
        name: 'Admin User',
        role: 'admin',
        phone: '+1234567890',
      })
      .select()
      .single();

    if (profileError) {
      console.error('Error creating user profile:', profileError);
      return;
    }

    console.log('Admin user created successfully!');
    console.log('Email: admin@cafe.com');
    console.log('Password: admin123');
    console.log('Role: admin');
    console.log('User ID:', authUser.user.id);
  } catch (error) {
    console.error('Error:', error);
  }
}

createAdminUser();
