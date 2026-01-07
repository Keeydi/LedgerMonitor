import express from 'express';
import db from '../database.js';
import { fileURLToPath } from 'url';
import path from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { analyzeImageWithAI, processDetectionResults } from '../ai_detection_service.js';
import { createViolationFromDetection } from './violations.js';
import monitoringService from '../monitoring_service.js';
import { shouldCreateNotification } from './notifications.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Use parent directory to match server static file serving path
const CAPTURED_IMAGES_DIR = path.join(__dirname, '..', 'captured_images');

// Ensure captured_images directory exists
async function ensureCapturedImagesDir() {
  if (!existsSync(CAPTURED_IMAGES_DIR)) {
    await mkdir(CAPTURED_IMAGES_DIR, { recursive: true });
  }
}

// Initialize directory on module load
ensureCapturedImagesDir().catch(console.error);

const router = express.Router();

// Prepare statements fresh each time to avoid "Statement closed" errors with sql.js
function getStatements() {
  return {
    getCamera: db.prepare('SELECT * FROM cameras WHERE id = ?'),
    updateLastCapture: db.prepare('UPDATE cameras SET lastCapture = ? WHERE id = ?'),
    createDetection: db.prepare(`
      INSERT INTO detections (id, cameraId, plateNumber, timestamp, confidence, imageUrl, bbox, class_name, imageBase64)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    createIncident: db.prepare(`
      INSERT INTO incidents (id, cameraId, locationId, detectionId, plateNumber, timestamp, reason, imageUrl, imageBase64, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    createNotification: db.prepare(`
      INSERT INTO notifications (id, type, title, message, cameraId, locationId, incidentId, detectionId, imageUrl, imageBase64, plateNumber, timeDetected, reason, timestamp, read)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    getOnlineCameras: db.prepare('SELECT * FROM cameras WHERE status = ?'),
  };
}

// POST trigger manual capture for a specific camera
router.post('/:cameraId', async (req, res) => {
  try {
    await ensureCapturedImagesDir();
    
    const statements = getStatements();
    const camera = statements.getCamera.get(req.params.cameraId);
    
    if (!camera) {
      return res.status(404).json({ error: 'Camera not found' });
    }

    if (camera.status !== 'online') {
      return res.status(400).json({ error: 'Camera is not online' });
    }

    // Update camera last capture time
    const now = new Date().toISOString();
    statements.updateLastCapture.run(now, req.params.cameraId);

    // Get image data from request body (base64)
    const { imageData } = req.body;
    let imageUrl = null;
    let imageBase64 = null;

    if (imageData) {
      try {
        // Extract base64 data (remove data:image/jpeg;base64, prefix if present)
        const base64Data = imageData.includes(',') 
          ? imageData.split(',')[1] 
          : imageData;
        
        // Convert base64 to buffer
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        // Generate filename
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
        const filename = `capture-${req.params.cameraId}-${timestamp}.jpg`;
        const filepath = path.join(CAPTURED_IMAGES_DIR, filename);
        
        // Save image to file
        await writeFile(filepath, imageBuffer);
        
        // Store filename in database (relative path)
        imageUrl = filename;
        
        // Store base64 in database for easy retrieval
        imageBase64 = imageData;
        
        console.log(`✅ Image saved: ${filename}`);
      } catch (imageError) {
        console.error('Error saving image:', imageError);
        // Continue without image if saving fails
      }
    }

    // Analyze image with AI (Gemini 2.5 Flash)
    let detections = [];
    let aiAnalysisError = null;
    
    if (imageBase64) {
      try {
        console.log('🤖 Analyzing image with AI (Gemini 2.5 Flash)...');
        const aiResult = await analyzeImageWithAI(imageBase64);
        
        if (aiResult.error) {
          console.warn('⚠️  AI analysis error:', aiResult.error);
          aiAnalysisError = aiResult.error;
        } else {
          console.log(`✅ AI detected ${aiResult.vehicles?.length || 0} vehicle(s)`);
        }
        
        // Process AI results into detection records
        detections = processDetectionResults(aiResult, req.params.cameraId, imageUrl, imageBase64);
        
      } catch (aiError) {
        console.error('❌ AI analysis failed:', aiError);
        aiAnalysisError = aiError.message;
        // Fallback: create placeholder detection
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
        const detectionId = `DET-${req.params.cameraId}-${timestamp}-0`;
        detections = [{
          id: detectionId,
          cameraId: req.params.cameraId,
          plateNumber: 'NONE',
          timestamp: new Date().toISOString(),
          confidence: 0.0,
          imageUrl,
          bbox: null,
          class_name: 'none',
          imageBase64
        }];
      }
    } else {
      // No image data - create placeholder detection
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
      const detectionId = `DET-${req.params.cameraId}-${timestamp}-0`;
      detections = [{
        id: detectionId,
        cameraId: req.params.cameraId,
        plateNumber: 'NONE',
        timestamp: new Date().toISOString(),
        confidence: 0.0,
        imageUrl: null,
        bbox: null,
        class_name: 'none',
        imageBase64: null
      }];
    }

    // Save all detections to database and check for plate visibility
    const savedDetections = [];
    const incidentsCreated = [];
    const notificationsCreated = [];
    const violationsCreated = [];
    
    // Track detected plates by location for real-time vehicle removal check
    const detectedPlatesByLocation = new Map();
    
    for (const detection of detections) {
      try {
        // Save detection
        statements.createDetection.run(
          detection.id,
          detection.cameraId,
          detection.plateNumber,
          detection.timestamp,
          detection.confidence,
          detection.imageUrl,
          detection.bbox,
          detection.class_name,
          detection.imageBase64
        );
        savedDetections.push(detection.id);
        
        // Get camera location
        const camera = statements.getCamera.get(detection.cameraId);
        const locationId = camera ? camera.locationId : 'UNKNOWN';
        
        // Track detected plates for real-time removal check
        const plateNotVisible = (
          detection.plateNumber === 'NONE' || 
          detection.plateNumber === null || 
          detection.plateNumber === '' ||
          detection.plateVisible === false
        );
        const isRealVehicle = detection.class_name && detection.class_name.toLowerCase() !== 'none';
        
        // Only track real vehicles with visible plates for removal detection
        if (isRealVehicle && !plateNotVisible && detection.plateNumber) {
          if (!detectedPlatesByLocation.has(locationId)) {
            detectedPlatesByLocation.set(locationId, []);
          }
          detectedPlatesByLocation.get(locationId).push(detection.plateNumber);
        }
        
        // Case 1: Real vehicle with visible plate - automatically create violation
        if (isRealVehicle && !plateNotVisible) {
          try {
            const violation = await createViolationFromDetection(
              detection.plateNumber,
              locationId,
              detection.id
            );
            if (violation) {
              violationsCreated.push(violation.id);
            }
          } catch (violationError) {
            console.error(`Failed to create automatic violation for detection ${detection.id}:`, violationError);
          }
        }
        
        // Case 2: Real vehicle with unreadable plate - create incident and notification
        if (isRealVehicle && plateNotVisible) {
          // Create incident record
          const incidentId = `INC-${detection.cameraId}-${Date.now()}`;
          try {
            statements.createIncident.run(
              incidentId,
              detection.cameraId,
              locationId,
              detection.id,
              detection.plateNumber || 'NONE',
              detection.timestamp,
              'Plate not visible or unreadable',
              detection.imageUrl,
              detection.imageBase64,
              'open'
            );
            incidentsCreated.push(incidentId);
            console.log(`📝 Incident logged: ${incidentId} - Plate not visible`);
          } catch (incidentError) {
            console.error(`Failed to create incident:`, incidentError);
          }
          
          // Check notification preferences before creating notification
          // Get first user (barangay_user) - in production, get from session
          const user = db.prepare('SELECT id FROM users LIMIT 1').get();
          const userId = user ? user.id : null;
          
          if (userId && shouldCreateNotification(userId, 'plate_not_visible')) {
            // Create notification for Barangay
            const notificationId = `NOTIF-${Date.now()}`;
            const notificationTitle = 'Unreadable License Plate Detected';
            const notificationMessage = `Vehicle detected at ${locationId} but license plate is not visible or readable. Immediate Barangay attention required.`;
            
            try {
              statements.createNotification.run(
                notificationId,
                'plate_not_visible',
                notificationTitle,
                notificationMessage,
                detection.cameraId,
                locationId,
                incidentId,
                detection.id,
                detection.imageUrl,
                detection.imageBase64,
                detection.plateNumber || 'NONE',
                detection.timestamp,
                'Plate not visible or unreadable',
                new Date().toISOString(),
                0 // not read
              );
              notificationsCreated.push(notificationId);
              console.log(`🔔 Notification created: ${notificationId} - Barangay alerted`);
            } catch (notifError) {
              console.error(`Failed to create notification:`, notifError);
            }
          } else {
            console.log(`ℹ️  Notification skipped (preferences disabled or no user): plate_not_visible`);
          }
        }
      } catch (dbError) {
        console.error(`Failed to save detection ${detection.id}:`, dbError);
      }
    }

    // Real-time vehicle removal detection - check immediately after saving detections
    let resolvedCount = 0;
    
    // Get camera location for this capture (camera already retrieved at line 55)
    const cameraLocationId = camera ? camera.locationId : null;
    
    if (cameraLocationId) {
      // If we have detected plates for this location, check for removals
      if (detectedPlatesByLocation.has(cameraLocationId)) {
        const detectedPlates = detectedPlatesByLocation.get(cameraLocationId);
        const resolved = monitoringService.checkVehicleRemovalRealTime(cameraLocationId, detectedPlates);
        resolvedCount += resolved;
      } else {
        // No vehicles detected at this location - check if any active warnings should be resolved
        // This handles the case where a capture shows no vehicles (empty parking zone)
        const resolved = monitoringService.checkVehicleRemovalRealTime(cameraLocationId, []);
        resolvedCount += resolved;
      }
    }

    res.json({ 
      success: true, 
      message: 'Capture triggered successfully',
      imageUrl: imageUrl,
      detections: savedDetections,
      vehicleCount: detections.filter(d => d.class_name !== 'none').length,
      violationsCreated: violationsCreated.length,
      violations: violationsCreated,
      violationsResolved: resolvedCount,
      incidentsCreated: incidentsCreated.length,
      notificationsCreated: notificationsCreated.length,
      aiAnalysisError: aiAnalysisError || undefined
    });

  } catch (error) {
    console.error('Capture error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST trigger capture for all online cameras
router.post('/', async (req, res) => {
  try {
    const statements = getStatements();
    const cameras = statements.getOnlineCameras.all('online');
    const now = new Date().toISOString();

    for (const camera of cameras) {
      // Update camera last capture time
      statements.updateLastCapture.run(now, camera.id);

      // Create a placeholder detection record
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
      const detectionId = `DET-${camera.id}-${timestamp}-0`;
      
      statements.createDetection.run(
        detectionId,
        camera.id,
        'NONE',
        new Date().toISOString(),
        0.0,
        null,
        null,
        'none',
        null // No base64 for batch captures without image data
      );
    }

    res.json({ 
      success: true, 
      message: 'Capture cycle triggered successfully',
      camerasProcessed: cameras.length
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

