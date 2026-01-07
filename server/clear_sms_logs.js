/**
 * Script to clear all SMS logs from the database
 * Run with: node server/clear_sms_logs.js
 */

import db from './database.js';

try {
  const result = db.prepare('DELETE FROM sms_logs').run();
  console.log(`✅ Successfully cleared ${result.changes} SMS log(s) from the database`);
  process.exit(0);
} catch (error) {
  console.error('❌ Error clearing SMS logs:', error);
  process.exit(1);
}

