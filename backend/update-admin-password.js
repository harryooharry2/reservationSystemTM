const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateAdminPassword() {
  try {
    console.log('Updating admin user password to test123...');

    // First, get the user by email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return;
    }

    const adminUser = users.users.find(user => user.email === 'admin@cafe.com');
    
    if (!adminUser) {
      console.error('Admin user not found');
      return;
    }

    // Update the user's password
    const { data, error } = await supabase.auth.admin.updateUserById(
      adminUser.id,
      { password: 'test123' }
    );

    if (error) {
      console.error('Error updating password:', error);
      return;
    }

    console.log('✅ Admin password updated successfully!');
    console.log('Email: admin@cafe.com');
    console.log('Password: test123');
    console.log('User ID:', adminUser.id);

  } catch (error) {
    console.error('Error:', error);
  }
}

updateAdminPassword();
