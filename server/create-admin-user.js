import db from './database.js';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Admin user credentials
const adminEmail = 'ledgerviolation@gmail.com';
const adminPassword = 'ledger123!';
const adminName = 'Admin User';
const adminRole = 'admin';

try {
  console.log('Checking database...');
  // Verify database is running and usable
  try {
    db.prepare('SELECT 1').get();
  } catch (checkError) {
    console.error('❌ Database is not running or not ready:', checkError?.message || checkError);
    process.exit(1);
  }
  console.log('Database OK. Creating admin user...');

  // Hash the password (same method as auth.js)
  const passwordHash = crypto.createHash('sha256').update(adminPassword).digest('hex');
  
  const adminId = 'USER-ADMIN-001';
  const adminEmailNorm = adminEmail.toLowerCase().trim();

  // Check if user already exists (by email or by admin id)
  const existingByEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmailNorm);
  const existingById = db.prepare('SELECT * FROM users WHERE id = ?').get(adminId);

  if (existingByEmail) {
    // Update existing user by email
    console.log('User already exists (by email). Updating...');
    db.prepare(`
      UPDATE users 
      SET password = ?, name = ?, role = ?
      WHERE email = ?
    `).run(passwordHash, adminName, adminRole, adminEmailNorm);
    console.log('✅ Admin user updated successfully!');
  } else if (existingById) {
    // Admin id exists with different email – update to this admin
    console.log('Admin user record exists (by id). Updating...');
    db.prepare(`
      UPDATE users 
      SET email = ?, password = ?, name = ?, role = ?
      WHERE id = ?
    `).run(adminEmailNorm, passwordHash, adminName, adminRole, adminId);
    console.log('✅ Admin user updated successfully!');
  } else {
    // Create new user
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO users (id, email, password, name, role, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(adminId, adminEmailNorm, passwordHash, adminName, adminRole, now);
    console.log('✅ Admin user created successfully!');
  }
  
  // Display user info
  const user = db.prepare('SELECT id, email, name, role FROM users WHERE email = ?').get(adminEmailNorm);
  console.log('\nUser Details:');
  console.log('  Email:', user.email);
  console.log('  Name:', user.name);
  console.log('  Role:', user.role);
  console.log('  ID:', user.id);
  console.log('\n✅ You can now log in with:');
  console.log('   Email: ledgerviolation@gmail.com');
  console.log('   Password: ledger123!');
  
  // Save database and exit on next tick so Node/libuv can clean up (avoids assertion on Windows)
  db.close();
  setImmediate(() => process.exit(0));
} catch (error) {
  console.error('❌ Error creating admin user:', error);
  console.error('   Details:', error.message);
  process.exit(1);
}
