const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Azure App Service persistent storage: /home/data
// Local development: ./data/babe-fight.db
const isAzure = process.env.WEBSITE_INSTANCE_ID !== undefined;
const dbPath = isAzure 
  ? '/home/data/babe-fight.db'
  : (process.env.DATABASE_PATH || './data/babe-fight.db');

const dbDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`✅ Created database directory: ${dbDir}`);
}

console.log(`📁 Database location: ${dbPath}`);

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
const initSchema = () => {
  // Users table - stateless authentication with PIN
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      pin TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Courses table
  db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      holes INTEGER DEFAULT 18,
      par_total INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Games table with dual PIN system
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_code TEXT NOT NULL UNIQUE,
      host_pin TEXT NOT NULL,
      guest_pin TEXT NOT NULL,
      host_id INTEGER NOT NULL,
      course_id INTEGER,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (host_id) REFERENCES users(id),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    )
  `);

  // Game participants (players in a game) with CO-HOST support
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('HOST', 'CO-HOST', 'GUEST')),
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(game_id, user_id)
    )
  `);

  // Scores table - with timestamp for "latest wins" conflict resolution
  db.exec(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      hole_number INTEGER NOT NULL,
      strokes INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(game_id, user_id, hole_number)
    )
  `);

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
    CREATE INDEX IF NOT EXISTS idx_game_participants_game ON game_participants(game_id);
    CREATE INDEX IF NOT EXISTS idx_scores_game ON scores(game_id);
    CREATE INDEX IF NOT EXISTS idx_scores_updated ON scores(updated_at);
  `);

  // Insert default courses
  const courseCount = db.prepare('SELECT COUNT(*) as count FROM courses').get().count;
  if (courseCount === 0) {
    db.exec(`
      INSERT INTO courses (name, holes, par_total) VALUES
      ('Standard 18-Hole Course', 18, 72),
      ('Executive 9-Hole Course', 9, 36),
      ('Championship Course', 18, 72),
      ('Short Course', 9, 27)
    `);
    console.log('✅ Default courses added');
  }

  console.log('✅ Database schema initialized');
};

initSchema();

module.exports = db;
