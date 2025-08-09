-- Auth migration: add roles and align users table with Supabase auth

-- Create role enum
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('customer','staff','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add role column to users if missing
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN role user_role NOT NULL DEFAULT 'customer';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Ensure email unique already; add index for role
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Basic RLS tweak: allow authenticated users to select their own row; admins can select all via role check
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

-- Optional: Seed an admin mapping helper function (no-op by default)
CREATE OR REPLACE FUNCTION is_admin(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM users WHERE id = p_user AND role = 'admin');
$$;