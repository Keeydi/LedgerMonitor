import db from './database.js';
import { sendSMS } from './sms_service.js';

/**
 * SMS Retry Service
 * Automatically retries failed SMS messages with exponential backoff
 */
class SMSRetryService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.RETRY_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes
    this.MAX_RETRIES = 3; // Maximum number of retry attempts
    this.RETRY_DELAYS = [
      5 * 60 * 1000,   // First retry: 5 minutes
      15 * 60 * 1000,  // Second retry: 15 minutes
      30 * 60 * 1000,  // Third retry: 30 minutes
    ];
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️  SMS retry service is already running');
      return;
    }

    console.log('🔄 Starting SMS retry service (5-minute check interval)');
    this.isRunning = true;
    
    // Run immediately on start, then every 5 minutes
    this.retryFailedSMS();
    this.intervalId = setInterval(() => {
      this.retryFailedSMS();
    }, this.RETRY_INTERVAL_MS);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 SMS retry service stopped');
  }

  async retryFailedSMS() {
    try {
      console.log('🔄 Checking for failed SMS messages to retry...');
      
      // Get failed SMS logs that haven't exceeded max retries
      const failedSMS = db.prepare(`
        SELECT * FROM sms_logs 
        WHERE status IN ('error', 'failed', 'unknown')
        AND retryCount < ?
        AND (lastRetryAt IS NULL OR lastRetryAt < datetime('now', '-' || ? || ' minutes'))
        ORDER BY sentAt ASC
        LIMIT 10
      `).all(this.MAX_RETRIES, this.RETRY_DELAYS[0] / (60 * 1000));

      if (failedSMS.length === 0) {
        console.log('✅ No failed SMS messages to retry');
        return;
      }

      console.log(`📋 Found ${failedSMS.length} failed SMS message(s) to retry`);

      let retriedCount = 0;
      let successCount = 0;

      for (const smsLog of failedSMS) {
        try {
          // Check if enough time has passed since last retry
          const retryIndex = smsLog.retryCount;
          if (retryIndex >= this.RETRY_DELAYS.length) {
            continue; // Skip if exceeded max retries
          }

          const lastRetryAt = smsLog.lastRetryAt ? new Date(smsLog.lastRetryAt) : new Date(smsLog.sentAt);
          const timeSinceLastRetry = Date.now() - lastRetryAt.getTime();
          const requiredDelay = this.RETRY_DELAYS[retryIndex];

          if (timeSinceLastRetry < requiredDelay) {
            // Not enough time has passed, skip this one
            continue;
          }

          // Attempt to resend SMS
          console.log(`🔄 Retrying SMS ${smsLog.id} (attempt ${retryIndex + 1}/${this.MAX_RETRIES})`);
          
          const smsResult = await sendSMS(
            smsLog.contactNumber,
            smsLog.message,
            'PhilSMS'
          );

          const newRetryCount = smsLog.retryCount + 1;
          const now = new Date().toISOString();

          if (smsResult.success) {
            // Success! Update status
            db.prepare(`
              UPDATE sms_logs 
              SET status = ?,
                  statusMessage = ?,
                  retryCount = ?,
                  lastRetryAt = ?,
                  deliveredAt = ?,
                  error = NULL
              WHERE id = ?
            `).run(
              smsResult.status || 'sent',
              `Retry successful: ${smsResult.statusMessage || 'SMS sent'}`,
              newRetryCount,
              now,
              now,
              smsLog.id
            );
            successCount++;
            console.log(`✅ SMS retry successful: ${smsLog.id}`);
          } else {
            // Still failed, update retry count
            db.prepare(`
              UPDATE sms_logs 
              SET status = ?,
                  statusMessage = ?,
                  retryCount = ?,
                  lastRetryAt = ?,
                  error = ?
              WHERE id = ?
            `).run(
              smsResult.status || 'error',
              `Retry ${newRetryCount} failed: ${smsResult.statusMessage || smsResult.error || 'Unknown error'}`,
              newRetryCount,
              now,
              smsResult.error || smsLog.error,
              smsLog.id
            );
            console.log(`⚠️  SMS retry failed: ${smsLog.id} - ${smsResult.error}`);
          }

          retriedCount++;

          // Add small delay between retries to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`❌ Error retrying SMS ${smsLog.id}:`, error);
        }
      }

      if (retriedCount > 0) {
        console.log(`✅ SMS retry check complete: ${retriedCount} retried, ${successCount} successful`);
      }
    } catch (error) {
      console.error('❌ Error in SMS retry check:', error);
    }
  }

  /**
   * Manually retry a specific SMS
   * @param {string} smsLogId - SMS log ID to retry
   * @returns {Promise<Object>} - Retry result
   */
  async retrySMS(smsLogId) {
    try {
      const smsLog = db.prepare('SELECT * FROM sms_logs WHERE id = ?').get(smsLogId);
      
      if (!smsLog) {
        return { success: false, error: 'SMS log not found' };
      }

      if (smsLog.retryCount >= this.MAX_RETRIES) {
        return { success: false, error: 'Maximum retry attempts exceeded' };
      }

      console.log(`🔄 Manually retrying SMS ${smsLogId}`);
      
      const smsResult = await sendSMS(
        smsLog.contactNumber,
        smsLog.message,
        'ParkSmart'
      );

      const newRetryCount = smsLog.retryCount + 1;
      const now = new Date().toISOString();

      if (smsResult.success) {
        db.prepare(`
          UPDATE sms_logs 
          SET status = ?,
              statusMessage = ?,
              retryCount = ?,
              lastRetryAt = ?,
              deliveredAt = ?,
              error = NULL
          WHERE id = ?
        `).run(
          smsResult.status || 'sent',
          `Manual retry successful: ${smsResult.statusMessage || 'SMS sent'}`,
          newRetryCount,
          now,
          now,
          smsLog.id
        );
        return { success: true, message: 'SMS retry successful' };
      } else {
        db.prepare(`
          UPDATE sms_logs 
          SET status = ?,
              statusMessage = ?,
              retryCount = ?,
              lastRetryAt = ?,
              error = ?
          WHERE id = ?
        `).run(
          smsResult.status || 'error',
          `Manual retry ${newRetryCount} failed: ${smsResult.statusMessage || smsResult.error || 'Unknown error'}`,
          newRetryCount,
          now,
          smsResult.error || smsLog.error,
          smsLog.id
        );
        return { success: false, error: smsResult.error || 'SMS retry failed' };
      }
    } catch (error) {
      console.error(`❌ Error manually retrying SMS ${smsLogId}:`, error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
const smsRetryService = new SMSRetryService();
export default smsRetryService;

