const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'password',
  database: 'bparking',
});

async function checkUserInDatabase() {
  console.log('🔍 Checking users in database...');
  
  try {
    // First, let's see the table structure
    const tableInfo = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Users table columns:');
    tableInfo.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`);
    });
    
    // Check for seeded users
    const result = await pool.query(
      'SELECT id, email, "phoneNumber", role, "isVerified" FROM users'
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Users found in database:');
      result.rows.forEach(user => {
        console.log(`   - ${user.email} (${user.phoneNumber}) - ${user.role}`);
      });
    } else {
      console.log('❌ No users found in database');
    }
    
    // Check total users
    const totalUsers = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`📊 Total users in database: ${totalUsers.rows[0].count}`);
    
  } catch (error) {
    console.log('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUserInDatabase(); 