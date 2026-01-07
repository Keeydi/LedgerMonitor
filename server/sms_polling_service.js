import db from './database.js';

/**
 * SMS Polling Service
 * 
 * Periodically checks SMS delivery status for pending/unknown status messages
 * This is a fallback if webhooks are not available or not working
 * 
 * Note: This service requires PhilSMS API to support status checking endpoint
 * If PhilSMS doesn't provide this, webhooks are the primary method
 */
class SMSPollingService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.POLLING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    this.MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours - stop checking after this
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️  SMS polling service is already running');
      return;
    }

    console.log('🔄 Starting SMS polling service (5-minute interval)');
    this.isRunning = true;
    
    // Run immediately on start, then every 5 minutes
    this.checkSMSStatus();
    this.intervalId = setInterval(() => {
      this.checkSMSStatus();
    }, this.POLLING_INTERVAL_MS);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 SMS polling service stopped');
  }

  async checkSMSStatus() {
    try {
      console.log('📨 Checking SMS delivery status...');
      
      // Get all SMS logs with pending/unknown status that are not too old
      const cutoffTime = new Date(Date.now() - this.MAX_AGE_MS).toISOString();
      const pendingLogs = db.prepare(`
        SELECT * FROM sms_logs 
        WHERE status IN ('unknown', 'pending', 'sent')
        AND sentAt > ?
        ORDER BY sentAt DESC
        LIMIT 50
      `).all(cutoffTime);

      if (pendingLogs.length === 0) {
        console.log('✅ No pending SMS logs to check');
        return;
      }

      console.log(`📋 Checking ${pendingLogs.length} pending SMS log(s)...`);

      // Note: This is a placeholder implementation
      // PhilSMS API may or may not support status checking endpoint
      // If they do, implement the API call here
      // For now, we'll just log that we're checking
      
      let updatedCount = 0;
      for (const log of pendingLogs) {
        // Extract messageId from statusMessage if available
        const messageIdMatch = log.statusMessage?.match(/Message ID: ([^\s-]+)/);
        const messageId = messageIdMatch ? messageIdMatch[1] : null;
        
        if (!messageId) {
          // No messageId available, skip this log
          continue;
        }

        // TODO: Implement PhilSMS status check API call if available
        // const statusResult = await checkSMSStatusWithPhilSMS(messageId);
        // if (statusResult) {
        //   // Update log with new status
        //   db.prepare(`
        //     UPDATE sms_logs 
        //     SET status = ?, 
        //         statusMessage = ?,
        //         deliveredAt = ?,
        //         error = ?
        //     WHERE id = ?
        //   `).run(
        //     statusResult.status,
        //     statusResult.statusMessage,
        //     statusResult.deliveredAt,
        //     statusResult.error,
        //     log.id
        //   );
        //   updatedCount++;
        // }
      }

      if (updatedCount > 0) {
        console.log(`✅ Updated ${updatedCount} SMS log(s) with delivery status`);
      } else {
        console.log('ℹ️  No SMS status updates available (webhook recommended)');
      }
    } catch (error) {
      console.error('❌ Error checking SMS status:', error);
    }
  }
}

// Export singleton instance
const smsPollingService = new SMSPollingService();
export default smsPollingService;

