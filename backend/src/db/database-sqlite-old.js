import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbDir = join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = join(dbDir, 'babe-fight.db');

// Configure SQLite for better concurrency and Azure Files compatibility
const db = new Database(dbPath, {
  verbose: console.log,
  timeout: 10000, // 10 second timeout for locks
});

// Optimize for network storage (Azure Files)
db.pragma('journal_mode = DELETE'); // WAL mode doesn't work well on network storage
db.pragma('synchronous = NORMAL'); // Balance between safety and performance
db.pragma('busy_timeout = 10000'); // Wait up to 10 seconds if database is locked
db.pragma('cache_size = -2000'); // 2MB cache

// Initialize schema
db.exec(`
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

  CREATE INDEX IF NOT EXISTS idx_games_host_pin ON games(host_pin);
  CREATE INDEX IF NOT EXISTS idx_games_guest_pin ON games(guest_pin);
  CREATE INDEX IF NOT EXISTS idx_players_game ON players(game_id);
`);

export default db;
