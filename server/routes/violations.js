import express from 'express';
import db from '../database.js';
import { sendSMS, formatParkingWarningSMS, shouldSendSMS } from '../sms_service.js';

const router = express.Router();

/**
 * Automatically create a violation from a detection
 * This function handles the complete flow: violation creation + SMS sending
 * @param {string} plateNumber - Vehicle plate number
 * @param {string} cameraLocationId - Camera location ID
 * @param {string} detectionId - Detection ID (optional, for tracking)
 * @returns {Promise<Object|null>} - Created violation object or null if not created
 */
export async function createViolationFromDetection(plateNumber, cameraLocationId, detectionId = null) {
  try {
    // Skip if plate is not visible
    if (!plateNumber || plateNumber.toUpperCase() === 'NONE') {
      return null;
    }

    // Get vehicle info first to check contact number and prevent duplicate SMS
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE plateNumber = ?').get(plateNumber);
    if (!vehicle) {
      console.log(`ℹ️  Vehicle ${plateNumber} not registered - skipping automatic violation creation`);
      return null;
    }

    // Check if SMS was already sent for this plate recently (within last 2 hours)
    // This prevents duplicate SMS sends even if violation doesn't exist yet
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const recentSmsLog = db.prepare(`
      SELECT * FROM sms_logs 
      WHERE plateNumber = ? 
      AND contactNumber = ?
      AND status IN ('sent', 'success')
      AND sentAt > ?
      ORDER BY sentAt DESC
      LIMIT 1
    `).get(plateNumber, vehicle.contactNumber, twoHoursAgo);
    
    if (recentSmsLog) {
      console.log(`ℹ️  SMS already sent recently for ${plateNumber} (within last 2 hours) - skipping duplicate send`);
      // Find or return existing violation
      const existingViolation = db.prepare(`
        SELECT * FROM violations 
        WHERE plateNumber = ? 
        AND cameraLocationId = ?
        AND status IN ('warning', 'pending')
        ORDER BY timeDetected DESC
        LIMIT 1
      `).get(plateNumber, cameraLocationId);
      
      if (existingViolation) {
        return {
          ...existingViolation,
          timeDetected: new Date(existingViolation.timeDetected),
          timeIssued: existingViolation.timeIssued ? new Date(existingViolation.timeIssued) : null,
          warningExpiresAt: existingViolation.warningExpiresAt ? new Date(existingViolation.warningExpiresAt) : null,
          smsSent: true,
          smsLogId: recentSmsLog.id
        };
      }
      return null;
    }

    // Check if there's already an active violation for this plate at this location
    const existingViolation = db.prepare(`
      SELECT * FROM violations 
      WHERE plateNumber = ? 
      AND cameraLocationId = ?
      AND status IN ('warning', 'pending')
    `).get(plateNumber, cameraLocationId);

    let violationId;
    let isExistingViolation = false;
    
    if (existingViolation) {
      console.log(`ℹ️  Active violation already exists for ${plateNumber} at ${cameraLocationId}`);
      violationId = existingViolation.id;
      isExistingViolation = true;
      
      // Check if SMS was already sent for this violation
      const existingSmsLog = db.prepare(`
        SELECT * FROM sms_logs 
        WHERE violationId = ?
        AND status IN ('sent', 'success')
        ORDER BY sentAt DESC
        LIMIT 1
      `).get(existingViolation.id);
      
      if (existingSmsLog) {
        console.log(`   ✅ SMS already sent for this violation (Log ID: ${existingSmsLog.id})`);
        return {
          ...existingViolation,
          timeDetected: new Date(existingViolation.timeDetected),
          timeIssued: existingViolation.timeIssued ? new Date(existingViolation.timeIssued) : null,
          warningExpiresAt: existingViolation.warningExpiresAt ? new Date(existingViolation.warningExpiresAt) : null,
          smsSent: true,
          smsLogId: existingSmsLog.id
        };
      }
    } else {
      // Generate new violation ID
      violationId = `VIOL-${plateNumber}-${Date.now()}`;
    }
    const timeDetected = new Date().toISOString();
    
    // Set status to 'warning' (automatic violations start as warnings)
    const status = 'warning';
    let expiresAt = null;
    let smsSent = false;
    let smsLogId = null;
    
    // Send SMS if conditions are met
    const smsCheck = shouldSendSMS(plateNumber, db);
    
    console.log(`📋 SMS Check for plate ${plateNumber}:`, {
      shouldSend: smsCheck.shouldSend,
      hasVehicle: !!smsCheck.vehicle,
      reason: smsCheck.reason,
      contactNumber: smsCheck.vehicle?.contactNumber
    });
    
    if (smsCheck.shouldSend && smsCheck.vehicle) {
      // Format and send SMS
      const smsMessage = formatParkingWarningSMS(plateNumber, cameraLocationId);
      const smsResult = await sendSMS(
        smsCheck.vehicle.contactNumber,
        smsMessage,
        'PhilSMS'
      );
      
      // Log SMS delivery status
      smsLogId = `SMS-${violationId}-${Date.now()}`;
      const sentAt = new Date().toISOString();
      
      // Store messageId in statusMessage for webhook matching
      const statusMessage = smsResult.messageId 
        ? `Message ID: ${smsResult.messageId} - ${smsResult.statusMessage || ''}`
        : (smsResult.statusMessage || '');
      
      try {
        db.prepare(`
          INSERT INTO sms_logs (
            id, violationId, plateNumber, contactNumber, message, 
            status, statusMessage, sentAt, deliveredAt, error, retryCount, lastRetryAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          smsLogId,
          violationId,
          plateNumber,
          smsCheck.vehicle.contactNumber,
          smsMessage,
          smsResult.status || 'unknown',
          statusMessage,
          sentAt,
          smsResult.success ? sentAt : null,
          smsResult.error || null,
          0, // retryCount
          null // lastRetryAt
        );
        
        if (smsResult.success) {
          smsSent = true;
          console.log(`✅ SMS sent successfully to ${smsCheck.vehicle.contactNumber} for plate ${plateNumber}`);
          console.log(`   Message ID: ${smsResult.messageId || 'N/A'}`);
          
          // Create notification for SMS sent
          try {
            // Get camera info from locationId
            const camera = db.prepare('SELECT * FROM cameras WHERE locationId = ?').get(cameraLocationId);
            const cameraId = camera?.id || null;
            
            const notificationId = `NOTIF-${violationId}-${Date.now()}`;
            const notificationTitle = `SMS Warning Sent - ${plateNumber}`;
            const notificationMessage = `SMS warning sent to vehicle owner for plate ${plateNumber} at location ${cameraLocationId}. Vehicle has 30 minutes to move.`;
            
            db.prepare(`
              INSERT INTO notifications (
                id, type, title, message, cameraId, locationId, 
                incidentId, detectionId, imageUrl, imageBase64, 
                plateNumber, timeDetected, reason, timestamp, read
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              notificationId,
              'sms_sent',
              notificationTitle,
              notificationMessage,
              cameraId,
              cameraLocationId,
              null, // incidentId
              detectionId,
              null, // imageUrl
              null, // imageBase64
              plateNumber,
              timeDetected,
              'SMS warning sent to vehicle owner',
              new Date().toISOString(),
              0 // not read
            );
          } catch (notifError) {
            console.error('Error creating notification:', notifError);
          }
        } else {
          console.error(`❌ SMS FAILED for plate ${plateNumber}:`);
          console.error(`   Error: ${smsResult.error || 'Unknown error'}`);
          console.error(`   Status: ${smsResult.status || 'unknown'}`);
          console.error(`   Status Message: ${smsResult.statusMessage || 'N/A'}`);
          if (smsResult.responseData) {
            console.error(`   API Response:`, JSON.stringify(smsResult.responseData, null, 2));
          }
        }
      } catch (smsLogError) {
        console.error('❌ Error logging SMS:', smsLogError);
      }
    } else {
      console.warn(`⚠️  SMS NOT SENT for plate ${plateNumber}:`, {
        reason: smsCheck.reason || 'Unknown reason',
        shouldSend: smsCheck.shouldSend,
        hasVehicle: !!smsCheck.vehicle,
        vehicleExists: !!smsCheck.vehicle
      });
    }
    
    // Set warningExpiresAt to 30 minutes from now (timer starts after SMS is sent)
    const expiresDate = new Date();
    expiresDate.setMinutes(expiresDate.getMinutes() + 30); // 30 minutes grace period
    expiresAt = expiresDate.toISOString();
    
    // Create violation only if it's a new violation
    if (!isExistingViolation) {
      db.prepare(`
        INSERT INTO violations (id, ticketId, plateNumber, cameraLocationId, timeDetected, status, warningExpiresAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        violationId,
        null, // ticketId (assigned later)
        plateNumber,
        cameraLocationId,
        timeDetected,
        status,
        expiresAt
      );
      
      // Create notification for new warning
      try {
        const camera = db.prepare('SELECT * FROM cameras WHERE locationId = ?').get(cameraLocationId);
        const cameraId = camera?.id || null;
        
        const warningNotificationId = `NOTIF-WARNING-${violationId}-${Date.now()}`;
        const warningTitle = `New Warning - ${plateNumber}`;
        const warningMessage = `Illegal parking detected for vehicle ${plateNumber} at ${cameraLocationId}. ${smsSent ? 'SMS sent to owner.' : 'SMS not sent.'} 30-minute grace period started.`;
        
        db.prepare(`
          INSERT INTO notifications (
            id, type, title, message, cameraId, locationId, 
            incidentId, detectionId, imageUrl, imageBase64, 
            plateNumber, timeDetected, reason, timestamp, read
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          warningNotificationId,
          'warning_created',
          warningTitle,
          warningMessage,
          cameraId,
          cameraLocationId,
          null, // incidentId
          detectionId,
          null, // imageUrl
          null, // imageBase64
          plateNumber,
          timeDetected,
          'Illegal parking warning created',
          new Date().toISOString(),
          0 // not read
        );
      } catch (notifError) {
        console.error('Error creating warning notification:', notifError);
      }
    } else {
      // Update existing violation's warningExpiresAt if SMS is being sent now
      if (smsSent) {
        db.prepare(`
          UPDATE violations 
          SET warningExpiresAt = ?
          WHERE id = ?
        `).run(expiresAt, violationId);
      }
    }

    const violation = db.prepare('SELECT * FROM violations WHERE id = ?').get(violationId);
    console.log(`✅ Automatic violation created: ${violationId} for plate ${plateNumber} at ${cameraLocationId}`);
    
    return {
      ...violation,
      timeDetected: new Date(violation.timeDetected),
      timeIssued: violation.timeIssued ? new Date(violation.timeIssued) : null,
      warningExpiresAt: violation.warningExpiresAt ? new Date(violation.warningExpiresAt) : null,
      smsSent: smsSent,
      smsLogId: smsLogId
    };
  } catch (error) {
    console.error(`❌ Error creating automatic violation for ${plateNumber}:`, error);
    return null;
  }
}

// GET all violations with optional filtering
router.get('/', (req, res) => {
  try {
    const { status, locationId, startDate, endDate, plateNumber } = req.query;
    
    let query = 'SELECT * FROM violations WHERE 1=1';
    const params = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (locationId) {
      query += ' AND cameraLocationId = ?';
      params.push(locationId);
    }
    
    if (startDate) {
      query += ' AND timeDetected >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      // Add one day to endDate to include the entire end date
      const endDateObj = new Date(endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      query += ' AND timeDetected < ?';
      params.push(endDateObj.toISOString());
    }
    
    if (plateNumber) {
      query += ' AND plateNumber LIKE ?';
      params.push(`%${plateNumber}%`);
    }
    
    query += ' ORDER BY timeDetected DESC';
    
    const violations = db.prepare(query).all(...params);
    
    res.json(violations.map(violation => ({
      ...violation,
      timeDetected: new Date(violation.timeDetected),
      timeIssued: violation.timeIssued ? new Date(violation.timeIssued) : null,
      warningExpiresAt: violation.warningExpiresAt ? new Date(violation.warningExpiresAt) : null
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET violations statistics
router.get('/stats', (req, res) => {
  try {
    const { startDate, endDate, locationId } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (startDate) {
      whereClause += ' AND timeDetected >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      const endDateObj = new Date(endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      whereClause += ' AND timeDetected < ?';
      params.push(endDateObj.toISOString());
    }
    
    if (locationId) {
      whereClause += ' AND cameraLocationId = ?';
      params.push(locationId);
    }
    
    // Get total violations
    const total = db.prepare(`SELECT COUNT(*) as count FROM violations ${whereClause}`).get(...params);
    
    // Get violations by status
    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM violations 
      ${whereClause}
      GROUP BY status
    `).all(...params);
    
    // Get violations by location
    const byLocation = db.prepare(`
      SELECT cameraLocationId, COUNT(*) as count 
      FROM violations 
      ${whereClause}
      GROUP BY cameraLocationId
      ORDER BY count DESC
    `).all(...params);
    
    // Get violations by date (daily)
    const byDate = db.prepare(`
      SELECT DATE(timeDetected) as date, COUNT(*) as count 
      FROM violations 
      ${whereClause}
      GROUP BY DATE(timeDetected)
      ORDER BY date DESC
      LIMIT 30
    `).all(...params);
    
    res.json({
      total: total.count,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item.count;
        return acc;
      }, {}),
      byLocation: byLocation,
      byDate: byDate
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET violation by ID
router.get('/:id', (req, res) => {
  try {
    const violation = db.prepare('SELECT * FROM violations WHERE id = ?').get(req.params.id);
    if (!violation) {
      return res.status(404).json({ error: 'Violation not found' });
    }
    res.json({
      ...violation,
      timeDetected: new Date(violation.timeDetected),
      timeIssued: violation.timeIssued ? new Date(violation.timeIssued) : null,
      warningExpiresAt: violation.warningExpiresAt ? new Date(violation.warningExpiresAt) : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create new violation
router.post('/', async (req, res) => {
  try {
    const { id, ticketId, plateNumber, cameraLocationId, status, warningExpiresAt } = req.body;
    
    if (!id || !plateNumber || !cameraLocationId || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Pre-registration check: Vehicle must be registered before violation can be created
    // Skip check if plateNumber is 'NONE' (unreadable plate - handled separately)
    if (plateNumber && plateNumber.toUpperCase() !== 'NONE') {
      const vehicle = db.prepare('SELECT * FROM vehicles WHERE plateNumber = ?').get(plateNumber);
      if (!vehicle) {
        return res.status(400).json({ 
          error: 'Vehicle not registered',
          details: `Plate number ${plateNumber} is not registered in the system. Vehicle must be pre-registered before violations can be created.`
        });
      }
    }

    const timeDetected = new Date().toISOString();
    
    // If status is 'warning' and warningExpiresAt is not provided, set it to 30 minutes from now
    // Timer starts AFTER SMS is sent
    let expiresAt = warningExpiresAt;
    let smsSent = false;
    let smsLogId = null;
    
    // Send SMS if status is 'warning' and conditions are met
    if (status === 'warning') {
      const smsCheck = shouldSendSMS(plateNumber, db);
      
      if (smsCheck.shouldSend && smsCheck.vehicle) {
        // Format and send SMS
        const smsMessage = formatParkingWarningSMS(plateNumber, cameraLocationId);
        const smsResult = await sendSMS(
          smsCheck.vehicle.contactNumber,
          smsMessage,
          'PhilSMS'
        );
        
      // Log SMS delivery status
      smsLogId = `SMS-${id}-${Date.now()}`;
      const sentAt = new Date().toISOString();
      
      // Store messageId in statusMessage for webhook matching
      const statusMessage = smsResult.messageId 
        ? `Message ID: ${smsResult.messageId} - ${smsResult.statusMessage || ''}`
        : (smsResult.statusMessage || '');
      
      try {
        db.prepare(`
          INSERT INTO sms_logs (
            id, violationId, plateNumber, contactNumber, message, 
            status, statusMessage, sentAt, deliveredAt, error, retryCount, lastRetryAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          smsLogId,
          id,
          plateNumber,
          smsCheck.vehicle.contactNumber,
          smsMessage,
          smsResult.status || 'unknown',
          statusMessage,
          sentAt,
          smsResult.success ? sentAt : null,
          smsResult.error || null,
          0, // retryCount
          null // lastRetryAt
        );
          
          if (smsResult.success) {
            smsSent = true;
            console.log(`✅ SMS sent to ${smsCheck.vehicle.contactNumber} for plate ${plateNumber}`);
          } else {
            console.warn(`⚠️  SMS failed for plate ${plateNumber}: ${smsResult.error}`);
          }
        } catch (smsLogError) {
          console.error('❌ Error logging SMS:', smsLogError);
        }
      } else {
        console.log(`ℹ️  SMS not sent for plate ${plateNumber}: ${smsCheck.reason || 'Unknown reason'}`);
      }
      
      // Set warningExpiresAt to 30 minutes from now (timer starts after SMS is sent)
      if (!expiresAt) {
        const expiresDate = new Date();
        expiresDate.setMinutes(expiresDate.getMinutes() + 30); // 30 minutes grace period
        expiresAt = expiresDate.toISOString();
      }
    }
    
    db.prepare(`
      INSERT INTO violations (id, ticketId, plateNumber, cameraLocationId, timeDetected, status, warningExpiresAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      ticketId || null,
      plateNumber,
      cameraLocationId,
      timeDetected,
      status,
      expiresAt || null
    );

    const violation = db.prepare('SELECT * FROM violations WHERE id = ?').get(id);
    const response = {
      ...violation,
      timeDetected: new Date(violation.timeDetected),
      timeIssued: violation.timeIssued ? new Date(violation.timeIssued) : null,
      warningExpiresAt: violation.warningExpiresAt ? new Date(violation.warningExpiresAt) : null,
      smsSent: smsSent,
      smsLogId: smsLogId
    };
    
    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update violation
router.put('/:id', (req, res) => {
  try {
    const { status, timeIssued, warningExpiresAt } = req.body;
    const violation = db.prepare('SELECT * FROM violations WHERE id = ?').get(req.params.id);
    
    if (!violation) {
      return res.status(404).json({ error: 'Violation not found' });
    }

    db.prepare(`
      UPDATE violations 
      SET status = ?, timeIssued = ?, warningExpiresAt = ?
      WHERE id = ?
    `).run(
      status || violation.status,
      timeIssued || violation.timeIssued,
      warningExpiresAt !== undefined ? warningExpiresAt : violation.warningExpiresAt,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM violations WHERE id = ?').get(req.params.id);
    res.json({
      ...updated,
      timeDetected: new Date(updated.timeDetected),
      timeIssued: updated.timeIssued ? new Date(updated.timeIssued) : null,
      warningExpiresAt: updated.warningExpiresAt ? new Date(updated.warningExpiresAt) : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE violation
router.delete('/:id', (req, res) => {
  try {
    const violation = db.prepare('SELECT * FROM violations WHERE id = ?').get(req.params.id);
    if (!violation) {
      return res.status(404).json({ error: 'Violation not found' });
    }

    db.prepare('DELETE FROM violations WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;



