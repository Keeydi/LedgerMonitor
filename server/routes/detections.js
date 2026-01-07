import express from 'express';
import db from '../database.js';

const router = express.Router();

// Prepare statements fresh each time to avoid "Statement closed" errors with sql.js
function getStatements() {
  return {
    getByCamera: db.prepare(`
      SELECT * FROM detections 
      WHERE cameraId = ? 
      ORDER BY timestamp DESC
    `),
    getLatest: db.prepare(`
      SELECT * FROM detections 
      WHERE cameraId = ? 
      ORDER BY timestamp DESC
      LIMIT 1
    `),
    getAll: db.prepare('SELECT * FROM detections ORDER BY timestamp DESC'),
  };
}

// GET all detections for a camera
// Optional query parameter: minConfidence (default: 0.0, recommended: 0.8 for ≥80% threshold)
router.get('/camera/:cameraId', (req, res) => {
  try {
    const statements = getStatements();
    const detections = statements.getByCamera.all(req.params.cameraId);
    
    // Apply confidence threshold if specified (≥80% = 0.8)
    const minConfidence = req.query.minConfidence ? parseFloat(req.query.minConfidence) : 0.0;
    
    const filteredDetections = detections
      .filter(detection => detection.confidence >= minConfidence)
      .map(detection => {
        let bbox = null;
        if (detection.bbox) {
          try {
            bbox = JSON.parse(detection.bbox);
          } catch (e) {
            bbox = null;
          }
        }
        
        return {
          ...detection,
          timestamp: detection.timestamp, // Keep as ISO string for grouping
          timestampDate: new Date(detection.timestamp), // Also provide Date object
          bbox: bbox,
          confidence: detection.confidence,
          imageBase64: detection.imageBase64 || null
        };
      });
    
    res.json(filteredDetections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET latest detection for a camera
router.get('/camera/:cameraId/latest', (req, res) => {
  try {
    const statements = getStatements();
    const detection = statements.getLatest.get(req.params.cameraId);
    
    // Return null instead of 404 when no detections found (this is expected for new cameras)
    if (!detection) {
      return res.json(null);
    }
    
    let bbox = null;
    if (detection.bbox) {
      try {
        bbox = JSON.parse(detection.bbox);
      } catch (e) {
        bbox = null;
      }
    }
    
    res.json({
      ...detection,
      timestamp: detection.timestamp, // Keep as ISO string
      timestampDate: new Date(detection.timestamp), // Also provide Date object
      bbox: bbox,
      confidence: detection.confidence,
      imageBase64: detection.imageBase64 || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET all detections (for debugging)
router.get('/all', (req, res) => {
  try {
    const statements = getStatements();
    const detections = statements.getAll.all();
    res.json(detections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

