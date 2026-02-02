/**
 * List user accounts from the database (id, email, name, role).
 * Passwords are stored as SHA-256 hashes and are not shown.
 */
import db from './database.js';

try {
  const users = db.prepare(`
    SELECT id, email, name, role, createdAt
    FROM users
    ORDER BY createdAt
  `).all();

  if (users.length === 0) {
    console.log('No users in database. Run: node create-admin-user.js');
    process.exit(0);
  }

  console.log('User accounts in database:\n');
  users.forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.email}`);
    console.log(`     ID: ${u.id} | Name: ${u.name || '-'} | Role: ${u.role} | Created: ${u.createdAt}`);
    console.log('');
  });
  console.log('Passwords are stored as SHA-256 hashes (not recoverable).');
  console.log('Default admin (from create-admin-user.js): ledgerviolation@gmail.com / ledger123!');
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
