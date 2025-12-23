import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

// Use environment variable to switch between SQL Server and SQLite
const useSQL = process.env.DB_TYPE === 'mssql' && process.env.DB_SERVER;

let sqlPool;
let sqliteDb;

// SQL Server configuration
const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 30000,
    requestTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// Initialize connection
async function initializeConnection() {
  if (useSQL) {
    try {
      sqlPool = await sql.connect(sqlConfig);
      console.log('✅ Connected to Azure SQL Database');
      await initializeSQLSchema();
    } catch (error) {
      console.error('❌ SQL Server connection error:', error);
      throw error;
    }
  } else {
    // Fallback to SQLite for local development
    const Database = (await import('better-sqlite3')).default;
    const { fileURLToPath } = await import('url');
    const { dirname, join } = await import('path');
    const fs = await import('fs');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const dbDir = join(__dirname, '../../data');
    
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    sqliteDb = new Database(join(dbDir, 'babe-fight.db'));
    console.log('✅ Using SQLite database');
    initializeSQLiteSchema();
  }
}

// Initialize SQL Server schema
async function initializeSQLSchema() {
  const pool = await getSQLPool();
  
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='games' AND xtype='U')
    CREATE TABLE games (
      id INT IDENTITY(1,1) PRIMARY KEY,
      host_pin NVARCHAR(50) NOT NULL UNIQUE,
      guest_pin NVARCHAR(50) NOT NULL UNIQUE,
      course_id NVARCHAR(50) NOT NULL,
      course_name NVARCHAR(255) NOT NULL,
      created_at DATETIME DEFAULT GETDATE(),
      status NVARCHAR(20) DEFAULT 'active'
    );
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='players' AND xtype='U')
    CREATE TABLE players (
      id INT IDENTITY(1,1) PRIMARY KEY,
      game_id INT NOT NULL,
      username NVARCHAR(255) NOT NULL,
      role NVARCHAR(10) CHECK(role IN ('host', 'player')) NOT NULL,
      handicap INT DEFAULT 0,
      joined_at DATETIME DEFAULT GETDATE(),
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      CONSTRAINT unique_game_username UNIQUE(game_id, username)
    );
  `);

  // Add handicap column if it doesn't exist (migration)
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM syscolumns WHERE id=OBJECT_ID('players') AND name='handicap')
    ALTER TABLE players ADD handicap INT DEFAULT 0;
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='scores' AND xtype='U')
    CREATE TABLE scores (
      id INT IDENTITY(1,1) PRIMARY KEY,
      player_id INT NOT NULL,
      hole_number INT NOT NULL,
      score INT,
      updated_at DATETIME DEFAULT GETDATE(),
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
      CONSTRAINT unique_player_hole UNIQUE(player_id, hole_number)
    );
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='game_turbo' AND xtype='U')
    CREATE TABLE game_turbo (
      id INT IDENTITY(1,1) PRIMARY KEY,
      game_id INT NOT NULL,
      hole_number INT NOT NULL,
      multiplier INT DEFAULT 1,
      updated_at DATETIME DEFAULT GETDATE(),
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      CONSTRAINT unique_game_hole UNIQUE(game_id, hole_number)
    );
  `);

  console.log('✅ SQL Server schema initialized');
}

// Initialize SQLite schema
function initializeSQLiteSchema() {
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host_pin TEXT NOT NULL UNIQUE,
      guest_pin TEXT NOT NULL UNIQUE,
      course_id TEXT NOT NULL,
      course_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      role TEXT CHECK(role IN ('host', 'player')) NOT NULL,
      handicap INTEGER DEFAULT 0,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      UNIQUE(game_id, username)
    );

    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      hole_number INTEGER NOT NULL,
      score INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
      UNIQUE(player_id, hole_number)
    );

    CREATE TABLE IF NOT EXISTS game_turbo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      hole_number INTEGER NOT NULL,
      multiplier INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      UNIQUE(game_id, hole_number)
    );
  `);

  // Add handicap column if it doesn't exist (migration for existing databases)
  try {
    sqliteDb.exec(`ALTER TABLE players ADD COLUMN handicap INTEGER DEFAULT 0;`);
  } catch (err) {
    // Column already exists, ignore error
    if (!err.message.includes('duplicate column name')) {
      console.error('Migration error:', err);
    }
  }

  console.log('✅ SQLite schema initialized');
}

// Get SQL pool
async function getSQLPool() {
  if (!sqlPool) {
    sqlPool = await sql.connect(sqlConfig);
  }
  return sqlPool;
}

// Database wrapper functions
const db = {
  // Execute query and return all rows
  async all(query, params = []) {
    if (useSQL) {
      const pool = await getSQLPool();
      const request = pool.request();
      params.forEach((param, i) => request.input(`p${i}`, param));
      let paramIndex = 0;
      const paramQuery = query.replace(/\?/g, () => `@p${paramIndex++}`);
      const result = await request.query(paramQuery);
      return result.recordset;
    } else {
      return sqliteDb.prepare(query).all(...params);
    }
  },

  // Execute query and return first row
  async get(query, params = []) {
    if (useSQL) {
      const rows = await this.all(query, params);
      return rows[0];
    } else {
      return sqliteDb.prepare(query).get(...params);
    }
  },

  // Execute query and return affected rows
  async run(query, params = []) {
    if (useSQL) {
      const pool = await getSQLPool();
      const request = pool.request();
      params.forEach((param, i) => request.input(`p${i}`, param));
      let paramIndex = 0;
      const paramQuery = query.replace(/\?/g, () => `@p${paramIndex++}`);
      
      // Get last inserted ID if it's an INSERT - combine with INSERT in same batch
      if (query.trim().toUpperCase().startsWith('INSERT')) {
        const batchQuery = `${paramQuery}; SELECT SCOPE_IDENTITY() AS id;`;
        console.log('Executing batch query:', batchQuery);
        const result = await request.query(batchQuery);
        // SCOPE_IDENTITY result is in the last recordset
        const lastRecordset = result.recordsets[result.recordsets.length - 1];
        const lastID = lastRecordset?.[0]?.id;
        console.log('SCOPE_IDENTITY returned:', lastID);
        return { lastID: lastID ? parseInt(lastID) : undefined, changes: result.rowsAffected[0] };
      }
      
      const result = await request.query(paramQuery);
      return { changes: result.rowsAffected[0] };
    } else {
      const stmt = sqliteDb.prepare(query);
      const result = stmt.run(...params);
      // SQLite returns lastInsertRowid, normalize to lastID for compatibility
      return { 
        lastID: result.lastInsertRowid, 
        changes: result.changes 
      };
    }
  },

  // Prepare statement (for compatibility)
  prepare(query) {
    if (useSQL) {
      // Return async wrapper
      return {
        all: async (...params) => await db.all(query, params),
        get: async (...params) => await db.get(query, params),
        run: async (...params) => await db.run(query, params),
      };
    } else {
      return sqliteDb.prepare(query);
    }
  },
};

// Initialize on import
await initializeConnection();

export default db;
