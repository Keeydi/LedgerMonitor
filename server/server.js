// Load environment variables from .env file FIRST
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from server directory
const envPath = path.join(__dirname, '.env');
const envResult = dotenv.config({ path: envPath, debug: false });

if (envResult.error) {
  console.warn(`⚠️  Warning: Could not load .env file from ${envPath}`);
  console.warn(`   Error: ${envResult.error.message}`);
}

import express from 'express';
import cors from 'cors';
import camerasRouter from './routes/cameras.js';
import vehiclesRouter from './routes/vehicles.js';
import violationsRouter from './routes/violations.js';
import capturesRouter from './routes/captures.js';
import detectionsRouter from './routes/detections.js';
import authRouter from './routes/auth.js';
import notificationsRouter from './routes/notifications.js';
import uploadRouter from './routes/upload.js';
import healthRouter from './routes/health.js';
import analyticsRouter from './routes/analytics.js';
import usersRouter from './routes/users.js';
import auditLogsRouter from './routes/audit_logs.js';
import hostsRouter from './routes/hosts.js';
import { auditLog } from './middleware/audit.js';
import db from './database.js';
import monitoringService from './monitoring_service.js';
import cleanupService from './cleanup_service.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Verify critical environment variables
if (!process.env.GEMINI_API_KEY) {
  console.warn('⚠️  GEMINI_API_KEY not set - using fallback');
}

// Check SMS service configuration
if (!process.env.PHILSMS_API_TOKEN && !process.env.PHILSMS_TOKEN) {
  console.warn('⚠️  PHILSMS_API_TOKEN not set - SMS notifications will not be sent');
  console.warn('   To enable SMS: Add PHILSMS_API_TOKEN to your .env file in the server directory');
} else {
  console.log('✅ SMS service configured - PHILSMS_API_TOKEN found');
}

// Trust proxy to get accurate client IP addresses
app.set('trust proxy', true);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request timeout middleware (30 seconds)
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout' });
    }
  });
  next();
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }
});

// Serve captured images
app.use('/captured_images', express.static(path.join(__dirname, 'captured_images')));

// Routes (audit logging applied in individual route files where needed)
app.use('/api/auth', authRouter);
app.use('/api/cameras', camerasRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/violations', violationsRouter);
app.use('/api/captures', capturesRouter);
app.use('/api/detections', detectionsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/health', healthRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/users', usersRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/hosts', hostsRouter);

// Start server with port conflict handling
function startServer(port, isRetry = false) {
  const server = app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
    if (isRetry) {
      console.log(`⚠️  Note: Server started on port ${port} instead of ${PORT}`);
      console.log(`⚠️  Update VITE_API_URL in your .env file to: http://localhost:${port}/api`);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️  Port ${port} is in use, trying another one...`);
      const nextPort = port + 1;
      // Limit to 10 retries to avoid infinite loop
      if (nextPort <= port + 10) {
        startServer(nextPort, true);
      } else {
        console.error(`❌ Could not find an available port. Tried ports ${PORT}-${port}`);
        console.error(`💡 Please free up port ${PORT} or set PORT environment variable to an available port`);
        process.exit(1);
      }
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });
}

startServer(PORT);

// Start monitoring service
monitoringService.start();

// Start cleanup service
cleanupService.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  
  monitoringService.stop();
  cleanupService.stop();
  db.close();
  console.log('👋 Database connection closed');
  process.exit(0);
});

