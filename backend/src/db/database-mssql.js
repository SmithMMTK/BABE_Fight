import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration
const config = {
  user: process.env.DB_USER || 'sqladmin',
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

// Create connection pool
let pool;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
    console.log('✅ Connected to Azure SQL Database');
  }
  return pool;
}

// Initialize database schema
async function initializeDatabase() {
  try {
    const pool = await getPool();
    
    // Create tables if they don't exist
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
        joined_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE NO ACTION,
        CONSTRAINT unique_game_username UNIQUE(game_id, username)
      );
    `);

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='scores' AND xtype='U')
      CREATE TABLE scores (
        id INT IDENTITY(1,1) PRIMARY KEY,
        player_id INT NOT NULL,
        hole_number INT NOT NULL,
        score INT,
        updated_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE NO ACTION,
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
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE NO ACTION,
        CONSTRAINT unique_game_hole UNIQUE(game_id, hole_number)
      );
    `);

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='game_handicap_h2h' AND xtype='U')
      CREATE TABLE game_handicap_h2h (
        id INT IDENTITY(1,1) PRIMARY KEY,
        game_id INT NOT NULL,
        from_player_id INT NOT NULL,
        to_player_id INT NOT NULL,
        front9_strokes INT DEFAULT 0,
        back9_strokes INT DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT unique_handicap_pair UNIQUE(game_id, from_player_id, to_player_id)
      );
    `);

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('players') AND name = 'handicap')
      BEGIN
        ALTER TABLE players ADD handicap INT DEFAULT 0;
      END;
    `);

    console.log('✅ Database schema initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}

// Database helper functions
const db = {
  async query(sql, params = []) {
    const pool = await getPool();
    const request = pool.request();
    
    // Add parameters
    params.forEach((param, index) => {
      request.input(`param${index}`, param);
    });
    
    const result = await request.query(sql);
    return result;
  },

  async get(sql, params = []) {
    const result = await this.query(sql, params);
    return result.recordset[0];
  },

  async all(sql, params = []) {
    const result = await this.query(sql, params);
    return result.recordset;
  },

  async run(sql, params = []) {
    const result = await this.query(sql, params);
    return result.rowsAffected[0];
  },

  // Helper to get last inserted ID
  async getLastInsertId() {
    const result = await this.query('SELECT SCOPE_IDENTITY() AS id');
    return result.recordset[0].id;
  },
};

// Initialize on module load
await initializeDatabase();

export default db;
