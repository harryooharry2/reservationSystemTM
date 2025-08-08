-- Cafe Reservation System Database Schema
-- Created for Supabase PostgreSQL

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE table_status AS ENUM ('available', 'occupied', 'reserved', 'maintenance');
CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cafe tables table
CREATE TABLE cafe_tables (
    id SERIAL PRIMARY KEY,
    table_number INTEGER UNIQUE NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    status table_status DEFAULT 'available',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reservations table
CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    table_id INTEGER NOT NULL REFERENCES cafe_tables(id) ON DELETE CASCADE,
    reservation_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status reservation_status DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure end_time is after start_time
    CONSTRAINT valid_time_range CHECK (end_time > start_time),
    -- Ensure reservation is in the future
    CONSTRAINT future_reservation CHECK (reservation_date >= CURRENT_DATE)
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_table_id ON reservations(table_id);
CREATE INDEX idx_reservations_date ON reservations(reservation_date);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_cafe_tables_status ON cafe_tables(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cafe_tables_updated_at BEFORE UPDATE ON cafe_tables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cafe_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Cafe tables policies (public read, admin write)
CREATE POLICY "Anyone can view cafe tables" ON cafe_tables
    FOR SELECT USING (true);

CREATE POLICY "Only authenticated users can create tables" ON cafe_tables
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Only authenticated users can update tables" ON cafe_tables
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Reservations policies
CREATE POLICY "Users can view their own reservations" ON reservations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reservations" ON reservations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reservations" ON reservations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reservations" ON reservations
    FOR DELETE USING (auth.uid() = user_id);

-- Insert sample data for testing
INSERT INTO cafe_tables (table_number, capacity, description) VALUES
(1, 2, 'Intimate table for two'),
(2, 4, 'Family table'),
(3, 6, 'Large group table'),
(4, 2, 'Window seat'),
(5, 4, 'Corner table'),
(6, 8, 'Party table'),
(7, 2, 'Bar seating'),
(8, 4, 'Garden view table');

-- Create a function to check table availability
CREATE OR REPLACE FUNCTION check_table_availability(
    p_table_id INTEGER,
    p_reservation_date DATE,
    p_start_time TIME,
    p_end_time TIME
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM reservations
        WHERE table_id = p_table_id
        AND reservation_date = p_reservation_date
        AND status IN ('pending', 'confirmed')
        AND (
            (start_time <= p_start_time AND end_time > p_start_time) OR
            (start_time < p_end_time AND end_time >= p_end_time) OR
            (start_time >= p_start_time AND end_time <= p_end_time)
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Create a function to get available tables
CREATE OR REPLACE FUNCTION get_available_tables(
    p_reservation_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_capacity INTEGER DEFAULT NULL
)
RETURNS TABLE (
    id INTEGER,
    table_number INTEGER,
    capacity INTEGER,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT ct.id, ct.table_number, ct.capacity, ct.description
    FROM cafe_tables ct
    WHERE ct.status = 'available'
    AND (p_capacity IS NULL OR ct.capacity >= p_capacity)
    AND check_table_availability(ct.id, p_reservation_date, p_start_time, p_end_time);
END;
$$ LANGUAGE plpgsql; 