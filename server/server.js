// Load environment variables from .env file FIRST
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from server directory
const envPath = path.join(__dirname, '.env');
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.warn(`⚠️  Warning: Could not load .env file from ${envPath}`);
  console.warn(`   Error: ${envResult.error.message}`);
} else {
  console.log(`✅ Loaded .env file from: ${envPath}`);
  if (envResult.parsed) {
    const envKeys = Object.keys(envResult.parsed);
    console.log(`   Found ${envKeys.length} environment variable(s): ${envKeys.join(', ')}`);
  }
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
import smsRouter from './routes/sms.js';
import uploadRouter from './routes/upload.js';
import healthRouter from './routes/health.js';
import analyticsRouter from './routes/analytics.js';
import usersRouter from './routes/users.js';
import auditLogsRouter from './routes/audit_logs.js';
import hostsRouter from './routes/hosts.js';
import { auditLog } from './middleware/audit.js';
import db from './database.js';
import monitoringService from './monitoring_service.js';
import smsPollingService from './sms_polling_service.js';
import smsRetryService from './sms_retry_service.js';
import cleanupService from './cleanup_service.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Verify environment variables are loaded
console.log('📋 Environment Configuration:');
console.log(`   PORT: ${PORT}`);
console.log(`   PHILSMS_API_TOKEN: ${process.env.PHILSMS_API_TOKEN ? '✅ Configured (length: ' + process.env.PHILSMS_API_TOKEN.length + ')' : '❌ NOT SET'}`);
console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '⚠️  Using fallback'}`);

// Trust proxy to get accurate client IP addresses
app.set('trust proxy', true);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
app.use('/api/sms', smsRouter);
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
    console.log(`📊 Database initialized: parking.db`);
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

// Start SMS retry service
smsRetryService.start();
console.log('🔄 SMS retry service started');

// Start cleanup service
cleanupService.start();
console.log('🧹 Cleanup service started');

// Start SMS polling service (optional - webhooks are primary method)
// Enable by setting ENABLE_SMS_POLLING=true in environment
if (process.env.ENABLE_SMS_POLLING === 'true') {
  smsPollingService.start();
  console.log('📨 SMS polling service enabled (webhooks recommended)');
} else {
  console.log('ℹ️  SMS polling service disabled (use webhooks at /api/sms/webhook)');
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  
  monitoringService.stop();
  smsRetryService.stop();
  cleanupService.stop();
  if (process.env.ENABLE_SMS_POLLING === 'true') {
    smsPollingService.stop();
  }
  db.close();
  console.log('👋 Database connection closed');
  process.exit(0);
});

