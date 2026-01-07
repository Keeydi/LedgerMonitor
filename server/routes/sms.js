import express from 'express';
import db from '../database.js';
import smsRetryService from '../sms_retry_service.js';

const router = express.Router();

/**
 * Webhook endpoint for PhilSMS delivery status callbacks
 * PhilSMS will POST to this endpoint when SMS delivery status changes
 * 
 * Expected payload format (based on common SMS provider patterns):
 * {
 *   message_id: string,
 *   status: 'delivered' | 'failed' | 'pending',
 *   phone_number: string,
 *   delivered_at?: string,
 *   error?: string
 * }
 */
router.post('/webhook', async (req, res) => {
  try {
    const { message_id, status, phone_number, delivered_at, error } = req.body;
    
    // Validate required fields
    if (!message_id || !status) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        received: req.body 
      });
    }

    console.log(`📨 SMS webhook received: message_id=${message_id}, status=${status}`);

    // Find SMS log by message_id or phone number
    // Note: PhilSMS may return message_id in different formats, so we'll search by phone number and recent timestamp
    let smsLog = null;
    
    // Try to find by message_id first (if we stored it)
    if (message_id) {
      // Check if we stored message_id in statusMessage or error field
      const logs = db.prepare(`
        SELECT * FROM sms_logs 
        WHERE statusMessage LIKE ? 
        OR error LIKE ?
        ORDER BY sentAt DESC
        LIMIT 10
      `).all(`%${message_id}%`, `%${message_id}%`);
      
      if (logs.length > 0) {
        // Find the most recent one that matches the phone number if provided
        if (phone_number) {
          const normalizedPhone = normalizePhoneNumber(phone_number);
          smsLog = logs.find(log => normalizePhoneNumber(log.contactNumber) === normalizedPhone);
        }
        if (!smsLog && logs.length > 0) {
          smsLog = logs[0]; // Use most recent if phone number doesn't match
        }
      }
    }
    
    // If not found by message_id, try to find by phone number and recent timestamp
    if (!smsLog && phone_number) {
      const normalizedPhone = normalizePhoneNumber(phone_number);
      const recentLogs = db.prepare(`
        SELECT * FROM sms_logs 
        WHERE contactNumber LIKE ?
        ORDER BY sentAt DESC
        LIMIT 5
      `).all(`%${normalizedPhone.slice(-10)}%`); // Match last 10 digits
      
      if (recentLogs.length > 0) {
        // Use the most recent pending/unknown status log
        smsLog = recentLogs.find(log => 
          log.status === 'unknown' || 
          log.status === 'pending' || 
          log.status === 'sent'
        ) || recentLogs[0];
      }
    }

    if (!smsLog) {
      console.warn(`⚠️  SMS log not found for webhook: message_id=${message_id}, phone=${phone_number}`);
      // Return success anyway to prevent webhook retries
      return res.status(200).json({ 
        message: 'Webhook received but SMS log not found',
        message_id 
      });
    }

    // Update SMS log with delivery status
    const updateStatus = status.toLowerCase();
    const deliveredAt = delivered_at ? new Date(delivered_at).toISOString() : 
                       (updateStatus === 'delivered' ? new Date().toISOString() : null);
    
    try {
      db.prepare(`
        UPDATE sms_logs 
        SET status = ?, 
            statusMessage = ?,
            deliveredAt = ?,
            error = ?
        WHERE id = ?
      `).run(
        updateStatus,
        `Delivery status: ${status}`,
        deliveredAt,
        error || smsLog.error, // Preserve existing error if new one is not provided
        smsLog.id
      );
      
      console.log(`✅ Updated SMS log ${smsLog.id}: status=${updateStatus}, deliveredAt=${deliveredAt || 'N/A'}`);
    } catch (updateError) {
      console.error(`❌ Error updating SMS log ${smsLog.id}:`, updateError);
      return res.status(500).json({ error: 'Failed to update SMS log' });
    }

    // Return success
    res.status(200).json({ 
      success: true,
      message: 'SMS delivery status updated',
      sms_log_id: smsLog.id,
      status: updateStatus
    });
  } catch (error) {
    console.error('❌ Error processing SMS webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Normalize phone number for comparison
 */
function normalizePhoneNumber(phone) {
  if (!phone) return '';
  return phone.replace(/[\s\-\(\)]/g, '').replace(/^\+63/, '0').replace(/^63/, '0');
}

/**
 * GET endpoint to manually check SMS delivery status
 * This can be used for periodic polling if webhooks are not available
 */
router.get('/status/:smsLogId', (req, res) => {
  try {
    const smsLog = db.prepare('SELECT * FROM sms_logs WHERE id = ?').get(req.params.smsLogId);
    
    if (!smsLog) {
      return res.status(404).json({ error: 'SMS log not found' });
    }
    
    res.json({
      ...smsLog,
      sentAt: new Date(smsLog.sentAt),
      deliveredAt: smsLog.deliveredAt ? new Date(smsLog.deliveredAt) : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET endpoint to list SMS logs with optional filters
 */
router.get('/logs', (req, res) => {
  try {
    const { status, plateNumber, limit = 100 } = req.query;
    
    let query = 'SELECT * FROM sms_logs';
    const conditions = [];
    const params = [];
    
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    
    if (plateNumber) {
      conditions.push('plateNumber = ?');
      params.push(plateNumber);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY sentAt DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const logs = db.prepare(query).all(...params);
    
    res.json(logs.map(log => ({
      ...log,
      sentAt: new Date(log.sentAt),
      deliveredAt: log.deliveredAt ? new Date(log.deliveredAt) : null,
      lastRetryAt: log.lastRetryAt ? new Date(log.lastRetryAt) : null
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST endpoint to manually retry a failed SMS
 */
router.post('/retry/:smsLogId', async (req, res) => {
  try {
    const result = await smsRetryService.retrySMS(req.params.smsLogId);
    
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE endpoint to clear all SMS logs
 */
router.delete('/logs', (req, res) => {
  try {
    const deleted = db.prepare('DELETE FROM sms_logs').run();
    
    res.json({
      success: true,
      message: 'All SMS logs have been cleared',
      deletedCount: deleted.changes
    });
  } catch (error) {
    console.error('Error clearing SMS logs:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

