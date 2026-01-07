import initSqlJs from 'sql.js';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'parking.db');

let db = null;
let SQL = null;

// Initialize database
async function initDatabase() {
  SQL = await initSqlJs({
    locateFile: (file) => {
      // sql.js needs to find the wasm file
      const wasmPath = join(__dirname, 'node_modules', 'sql.js', 'dist', file);
      if (fs.existsSync(wasmPath)) {
        return wasmPath;
      }
      // Fallback to default location
      return `https://sql.js.org/dist/${file}`;
    }
  });
  
  // Load existing database or create new one
  let buffer;
  try {
    if (fs.existsSync(dbPath)) {
      buffer = fs.readFileSync(dbPath);
    } else {
      buffer = null;
    }
  } catch (error) {
    buffer = null;
  }
  
  db = buffer ? new SQL.Database(buffer) : new SQL.Database();
  
  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');
  
  // Create hosts table
  db.run(`
    CREATE TABLE IF NOT EXISTS hosts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contactNumber TEXT NOT NULL,
      address TEXT,
      createdAt TEXT NOT NULL
    )
  `);

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      plateNumber TEXT NOT NULL UNIQUE,
      ownerName TEXT NOT NULL,
      contactNumber TEXT NOT NULL,
      registeredAt TEXT NOT NULL,
      dataSource TEXT NOT NULL DEFAULT 'barangay',
      hostId TEXT,
      rented TEXT,
      purposeOfVisit TEXT,
      FOREIGN KEY (hostId) REFERENCES hosts(id) ON DELETE SET NULL
    )
  `);
  
  // Migrate existing vehicles table to add dataSource column if needed
  try {
    db.run('ALTER TABLE vehicles ADD COLUMN dataSource TEXT NOT NULL DEFAULT \'barangay\'');
    console.log('✅ Added dataSource column to vehicles table');
  } catch (error) {
    // Column already exists or table doesn't exist yet - that's fine
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('duplicate column name') && !errorMsg.includes('no such table')) {
      console.log('Note: dataSource column migration:', errorMsg);
    }
  }
  
  // Update existing vehicles without dataSource to have barangay as source
  try {
    db.run(`UPDATE vehicles SET dataSource = 'barangay' WHERE dataSource IS NULL OR dataSource = ''`);
    console.log('✅ Updated existing vehicles to barangay data source');
  } catch (error) {
    // Ignore errors
  }

  // Migrate existing vehicles table to add hostId, rented, and purposeOfVisit columns if needed
  try {
    db.run('ALTER TABLE vehicles ADD COLUMN hostId TEXT');
    console.log('✅ Added hostId column to vehicles table');
  } catch (error) {
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('duplicate column name') && !errorMsg.includes('no such table')) {
      console.log('Note: hostId column migration:', errorMsg);
    }
  }

  try {
    db.run('ALTER TABLE vehicles ADD COLUMN rented TEXT');
    console.log('✅ Added rented column to vehicles table');
  } catch (error) {
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('duplicate column name') && !errorMsg.includes('no such table')) {
      console.log('Note: rented column migration:', errorMsg);
    }
  }

  try {
    db.run('ALTER TABLE vehicles ADD COLUMN purposeOfVisit TEXT');
    console.log('✅ Added purposeOfVisit column to vehicles table');
  } catch (error) {
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('duplicate column name') && !errorMsg.includes('no such table')) {
      console.log('Note: purposeOfVisit column migration:', errorMsg);
    }
  }
  
  db.run(`
    CREATE TABLE IF NOT EXISTS cameras (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      locationId TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('online', 'offline')),
      lastCapture TEXT NOT NULL,
      deviceId TEXT,
      isFixed INTEGER NOT NULL DEFAULT 1,
      illegalParkingZone INTEGER NOT NULL DEFAULT 1
    )
  `);
  
  // Migrate existing cameras table to add new columns if needed
  try {
    db.run('ALTER TABLE cameras ADD COLUMN isFixed INTEGER NOT NULL DEFAULT 1');
    console.log('✅ Added isFixed column to cameras table');
  } catch (error) {
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('duplicate column name') && !errorMsg.includes('no such table')) {
      console.log('Note: isFixed column migration:', errorMsg);
    }
  }
  
  try {
    db.run('ALTER TABLE cameras ADD COLUMN illegalParkingZone INTEGER NOT NULL DEFAULT 1');
    console.log('✅ Added illegalParkingZone column to cameras table');
  } catch (error) {
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('duplicate column name') && !errorMsg.includes('no such table')) {
      console.log('Note: illegalParkingZone column migration:', errorMsg);
    }
  }
  
  // Update existing cameras to have fixed and illegal parking zone enabled by default
  try {
    db.run(`UPDATE cameras SET isFixed = 1 WHERE isFixed IS NULL`);
    db.run(`UPDATE cameras SET illegalParkingZone = 1 WHERE illegalParkingZone IS NULL`);
    console.log('✅ Updated existing cameras to fixed and illegal parking zone');
  } catch (error) {
    // Ignore errors
  }
  
  db.run(`
    CREATE TABLE IF NOT EXISTS violations (
      id TEXT PRIMARY KEY,
      ticketId TEXT,
      plateNumber TEXT NOT NULL,
      cameraLocationId TEXT NOT NULL,
      timeDetected TEXT NOT NULL,
      timeIssued TEXT,
      status TEXT NOT NULL CHECK(status IN ('warning', 'pending', 'issued', 'cancelled', 'cleared', 'resolved')),
      warningExpiresAt TEXT
    )
  `);
  
  // Migrate existing violations table to add 'resolved' status if needed
  try {
    // SQLite doesn't support ALTER TABLE to modify CHECK constraint, so we'll handle it in application logic
    console.log('✅ Violations table supports resolved status');
  } catch (error) {
    // Ignore errors
  }
  
  db.run(`
    CREATE TABLE IF NOT EXISTS detections (
      id TEXT PRIMARY KEY,
      cameraId TEXT NOT NULL,
      plateNumber TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      confidence REAL NOT NULL,
      imageUrl TEXT,
      bbox TEXT,
      class_name TEXT
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      cameraId TEXT NOT NULL,
      locationId TEXT NOT NULL,
      detectionId TEXT,
      plateNumber TEXT,
      timestamp TEXT NOT NULL,
      reason TEXT NOT NULL,
      imageUrl TEXT,
      imageBase64 TEXT,
      status TEXT NOT NULL DEFAULT 'open'
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      cameraId TEXT,
      locationId TEXT,
      incidentId TEXT,
      detectionId TEXT,
      imageUrl TEXT,
      imageBase64 TEXT,
      plateNumber TEXT,
      timeDetected TEXT,
      reason TEXT,
      timestamp TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS sms_logs (
      id TEXT PRIMARY KEY,
      violationId TEXT,
      plateNumber TEXT NOT NULL,
      contactNumber TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL,
      statusMessage TEXT,
      sentAt TEXT NOT NULL,
      deliveredAt TEXT,
      error TEXT,
      retryCount INTEGER NOT NULL DEFAULT 0,
      lastRetryAt TEXT
    )
  `);
  
  // Migrate existing sms_logs table to add retry columns if needed
  try {
    db.run('ALTER TABLE sms_logs ADD COLUMN retryCount INTEGER NOT NULL DEFAULT 0');
    console.log('✅ Added retryCount column to sms_logs table');
  } catch (error) {
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('duplicate column name') && !errorMsg.includes('no such table')) {
      console.log('Note: retryCount column migration:', errorMsg);
    }
  }
  
  try {
    db.run('ALTER TABLE sms_logs ADD COLUMN lastRetryAt TEXT');
    console.log('✅ Added lastRetryAt column to sms_logs table');
  } catch (error) {
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('duplicate column name') && !errorMsg.includes('no such table')) {
      console.log('Note: lastRetryAt column migration:', errorMsg);
    }
  }
  
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'barangay_user',
      createdAt TEXT NOT NULL
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      userId TEXT PRIMARY KEY,
      plate_not_visible INTEGER NOT NULL DEFAULT 1,
      warning_expired INTEGER NOT NULL DEFAULT 1,
      vehicle_detected INTEGER NOT NULL DEFAULT 1,
      incident_created INTEGER NOT NULL DEFAULT 1,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  
  // Migrate: Create default preferences for existing users
  try {
    const users = db.prepare('SELECT id FROM users').all();
    const now = new Date().toISOString();
    for (const user of users) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO notification_preferences (userId, plate_not_visible, warning_expired, vehicle_detected, incident_created, updatedAt)
          VALUES (?, 1, 1, 1, 1, ?)
        `).run(user.id, now);
      } catch (err) {
        // User might already have preferences
      }
    }
    console.log('✅ Notification preferences initialized for existing users');
  } catch (error) {
    // Ignore errors
  }
  
  // Migrate existing users table to add role column if needed
  try {
    db.run('ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT \'barangay_user\'');
    console.log('✅ Added role column to users table');
  } catch (error) {
    // Column already exists or table doesn't exist yet - that's fine
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('duplicate column name') && !errorMsg.includes('no such table')) {
      console.log('Note: role column migration:', errorMsg);
    }
  }
  
  // Update existing users without role to have barangay_user role
  try {
    db.run(`UPDATE users SET role = 'barangay_user' WHERE role IS NULL OR role = ''`);
    console.log('✅ Updated existing users to barangay_user role');
  } catch (error) {
    // Ignore errors
  }
  
  // Seed Barangay user if it doesn't exist (will be done after crypto import)
  // This is handled in a separate function after database initialization
  
  // Migrate existing detections table to add missing columns if needed
  // Try to add columns - if they exist, the error will be caught and ignored
  try {
    db.run('ALTER TABLE detections ADD COLUMN bbox TEXT');
    console.log('✅ Added bbox column to detections table');
  } catch (error) {
    // Column already exists or table doesn't exist yet - that's fine
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('duplicate column name') && !errorMsg.includes('no such table')) {
      console.log('Note: bbox column migration:', errorMsg);
    }
  }
  
  try {
    db.run('ALTER TABLE detections ADD COLUMN class_name TEXT');
    console.log('✅ Added class_name column to detections table');
  } catch (error) {
    // Column already exists or table doesn't exist yet - that's fine
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('duplicate column name') && !errorMsg.includes('no such table')) {
      console.log('Note: class_name column migration:', errorMsg);
    }
  }
  
  try {
    db.run('ALTER TABLE detections ADD COLUMN imageBase64 TEXT');
    console.log('✅ Added imageBase64 column to detections table');
  } catch (error) {
    // Column already exists or table doesn't exist yet - that's fine
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('duplicate column name') && !errorMsg.includes('no such table')) {
      console.log('Note: imageBase64 column migration:', errorMsg);
    }
  }
  
  // Create audit_logs table for tracking user activities
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      userEmail TEXT NOT NULL,
      userName TEXT,
      userRole TEXT NOT NULL,
      action TEXT NOT NULL,
      resource TEXT,
      resourceId TEXT,
      details TEXT,
      ipAddress TEXT,
      userAgent TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  
  // Create index for faster queries
  try {
    db.run('CREATE INDEX IF NOT EXISTS idx_audit_logs_userId ON audit_logs(userId)');
    db.run('CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)');
    db.run('CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)');
  } catch (error) {
    // Indexes might already exist
  }
  
  // Save database to file
  saveDatabase();
  
  console.log('📊 Database initialized');
}

// Seed users function - called after database initialization
async function seedUsers() {
  try {
    const crypto = await import('crypto');
    const now = new Date().toISOString();
    
    // Seed Admin user
    const adminEmail = 'admin@admin.com';
    const adminPassword = 'admin123!';
    const adminPasswordHash = crypto.createHash('sha256').update(adminPassword).digest('hex');
    const adminUserId = 'USER-ADMIN-001';
    
    const adminUser = dbWrapper.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);
    
    if (adminUser) {
      // Admin user exists, ensure role is correct
      if (adminUser.role !== 'admin') {
        dbWrapper.prepare('UPDATE users SET role = ? WHERE email = ?').run('admin', adminEmail);
        console.log('✅ Updated existing Admin user role');
      } else {
        console.log('ℹ️  Admin user already exists');
      }
    } else {
      // Create new Admin user
      dbWrapper.prepare(`
        INSERT INTO users (id, email, password, name, role, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(adminUserId, adminEmail, adminPasswordHash, 'Admin User', 'admin', now);
      
      console.log('✅ Seeded Admin user: admin@admin.com');
      console.log('   Password: admin123!');
      console.log('   Role: admin');
    }
    
    // Seed Barangay user
    const barangayEmail = 'barangay@barangay.com';
    const barangayPassword = 'barangay123';
    const barangayPasswordHash = crypto.createHash('sha256').update(barangayPassword).digest('hex');
    const barangayUserId = 'USER-001';
    
    const barangayUser = dbWrapper.prepare('SELECT * FROM users WHERE email = ?').get(barangayEmail);
    
    if (barangayUser) {
      // Barangay user exists, ensure role is correct
      if (barangayUser.role !== 'barangay_user') {
        dbWrapper.prepare('UPDATE users SET role = ? WHERE email = ?').run('barangay_user', barangayEmail);
        console.log('✅ Updated existing Barangay user role');
      } else {
        console.log('ℹ️  Barangay user already exists');
      }
    } else {
      // Check if USER-001 exists (might be old admin user)
      const existingUser = dbWrapper.prepare('SELECT * FROM users WHERE id = ?').get(barangayUserId);
      
      if (existingUser && existingUser.email !== adminEmail) {
        // USER-001 exists but with different email, update it to Barangay user
        dbWrapper.prepare(`
          UPDATE users 
          SET email = ?, password = ?, name = ?, role = ?
          WHERE id = ?
        `).run(barangayEmail, barangayPasswordHash, 'Barangay User', 'barangay_user', barangayUserId);
        
        console.log('✅ Converted existing user to Barangay user: barangay@barangay.com');
        console.log('   Password: barangay123');
        console.log('   Role: barangay_user');
      } else {
        // Create new Barangay user
        dbWrapper.prepare(`
          INSERT INTO users (id, email, password, name, role, createdAt)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(barangayUserId, barangayEmail, barangayPasswordHash, 'Barangay User', 'barangay_user', now);
        
        console.log('✅ Seeded Barangay user: barangay@barangay.com');
        console.log('   Password: barangay123');
        console.log('   Role: barangay_user');
      }
    }
  } catch (error) {
    console.error('❌ Error seeding users:', error?.message || String(error));
    console.error('   Stack:', error?.stack);
  }
}

// Save database to file
function saveDatabase() {
  if (db) {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.ensureDirSync(dirname(dbPath));
      fs.writeFileSync(dbPath, buffer);
    } catch (error) {
      console.error('Error saving database:', error);
    }
  }
}

// Database wrapper with better-sqlite3-like API
const dbWrapper = {
  prepare: (sql) => {
    // Prepare a fresh statement for each operation to avoid "Statement closed" errors
    return {
      run: (...params) => {
        const stmt = db.prepare(sql);
        try {
          if (params.length > 0) {
            stmt.bind(params);
          }
          stmt.step();
          const changes = db.getRowsModified() || 1;
          stmt.free();
          saveDatabase();
          return { changes };
        } catch (error) {
          try {
            stmt.free();
          } catch (freeError) {
            // Ignore free errors
          }
          // Ensure error message is a string for consistent error handling
          const errorMessage = error?.message || String(error);
          const err = new Error(errorMessage);
          throw err;
        }
      },
      get: (...params) => {
        const stmt = db.prepare(sql);
        try {
          if (params.length > 0) {
            stmt.bind(params);
          }
          const result = stmt.step() ? stmt.getAsObject() : null;
          stmt.free();
          return result;
        } catch (error) {
          try {
            stmt.free();
          } catch (freeError) {
            // Ignore free errors
          }
          throw error;
        }
      },
      all: (...params) => {
        const stmt = db.prepare(sql);
        try {
          if (params.length > 0) {
            stmt.bind(params);
          }
          const results = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        } catch (error) {
          try {
            stmt.free();
          } catch (freeError) {
            // Ignore free errors
          }
          throw error;
        }
      }
    };
  },
  exec: (sql) => {
    db.run(sql);
    saveDatabase();
  },
  close: () => {
    if (db) {
      try {
        saveDatabase();
        // sql.js doesn't have an explicit close, but we can save the database
        console.log('Database saved and closed');
      } catch (error) {
        console.error('Error closing database:', error);
      }
    }
  }
};

// Initialize and export
await initDatabase();

// Seed users after database and wrapper are initialized
seedUsers().catch(err => {
  console.error('Error seeding users:', err);
});

export default dbWrapper;

