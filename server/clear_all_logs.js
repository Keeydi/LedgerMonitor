/**
 * Script to clear all logs from the database
 * Run with: node server/clear_all_logs.js
 */

import db from './database.js';

try {
  console.log('🧹 Clearing all logs from database...\n');
  
  // Clear SMS logs
  const smsResult = db.prepare('DELETE FROM sms_logs').run();
  console.log(`✅ Cleared ${smsResult.changes} SMS log(s)`);
  
  // Clear violations
  const violationsResult = db.prepare('DELETE FROM violations').run();
  console.log(`✅ Cleared ${violationsResult.changes} violation(s)`);
  
  // Clear detections
  const detectionsResult = db.prepare('DELETE FROM detections').run();
  console.log(`✅ Cleared ${detectionsResult.changes} detection(s)`);
  
  // Clear incidents
  const incidentsResult = db.prepare('DELETE FROM incidents').run();
  console.log(`✅ Cleared ${incidentsResult.changes} incident(s)`);
  
  // Clear notifications
  const notificationsResult = db.prepare('DELETE FROM notifications').run();
  console.log(`✅ Cleared ${notificationsResult.changes} notification(s)`);
  
  console.log('\n✅ All logs cleared successfully!');
  process.exit(0);
} catch (error) {
  console.error('❌ Error clearing logs:', error);
  process.exit(1);
}
