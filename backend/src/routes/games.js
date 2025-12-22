import express from 'express';
import db from '../db/database.js';
import { generateUniquePINs } from '../utils/pinGenerator.js';
import axios from 'axios';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Load turbo configuration
const turboConfigPath = join(__dirname, '../../../Resources/turbo-default.json');
let turboConfig = {};
try {
  turboConfig = JSON.parse(fs.readFileSync(turboConfigPath, 'utf8'));
} catch (err) {
  console.warn('Failed to load turbo config, using empty config');
}

// Add points and turbo to course holes
function enhanceCourseData(course) {
  return {
    ...course,
    holes: course.holes.map(hole => ({
      ...hole,
      point: turboConfig[hole.hole] || 1
    }))
  };
}

// Create new game
router.post('/create', async (req, res) => {
  try {
    const { courseId, courseName, hostUsername } = req.body;

    if (!courseId || !courseName || !hostUsername) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get existing PINs
    const existingPINs = db
      .prepare('SELECT host_pin, guest_pin FROM games WHERE status = ?')
      .all('active')
      .flatMap(g => [g.host_pin, g.guest_pin]);

    // Generate unique PINs
    const { hostPin, guestPin } = generateUniquePINs(existingPINs);

    // Create game
    const insertGame = db.prepare(`
      INSERT INTO games (host_pin, guest_pin, course_id, course_name)
      VALUES (?, ?, ?, ?)
    `);
    const result = insertGame.run(hostPin, guestPin, courseId, courseName);
    const gameId = result.lastInsertRowid;

    // Add host as player
    const insertPlayer = db.prepare(`
      INSERT INTO players (game_id, username, role)
      VALUES (?, ?, 'host')
    `);
    insertPlayer.run(gameId, hostUsername);

    res.json({
      gameId,
      hostPin,
      guestPin,
      courseId,
      courseName
    });
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Join game
router.post('/join', (req, res) => {
  try {
    const { pin, username } = req.body;

    if (!pin || !username) {
      return res.status(400).json({ error: 'Missing PIN or username' });
    }

    // Find game by either host or guest PIN
    const game = db
      .prepare('SELECT * FROM games WHERE (host_pin = ? OR guest_pin = ?) AND status = ?')
      .get(pin, pin, 'active');

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Check if username already exists
    const existingPlayer = db
      .prepare('SELECT * FROM players WHERE game_id = ? AND username = ?')
      .get(game.id, username);

    // If player exists, return existing player data (ข้อ 6)
    if (existingPlayer) {
      return res.json({
        gameId: game.id,
        playerId: existingPlayer.id,
        hostPin: game.host_pin,
        guestPin: game.guest_pin,
        courseId: game.course_id,
        courseName: game.course_name,
        role: existingPlayer.role
      });
    }

    // Determine role
    const role = (pin === game.host_pin) ? 'host' : 'player';

    // Add player
    const insertPlayer = db.prepare(`
      INSERT INTO players (game_id, username, role)
      VALUES (?, ?, ?)
    `);
    const result = insertPlayer.run(game.id, username, role);

    res.json({
      gameId: game.id,
      playerId: result.lastInsertRowid,
      hostPin: game.host_pin,
      guestPin: game.guest_pin,
      courseId: game.course_id,
      courseName: game.course_name,
      role
    });
  } catch (error) {
    console.error('Join game error:', error);
    res.status(500).json({ error: 'Failed to join game' });
  }
});

// Get game details
router.get('/:gameId', (req, res) => {
  try {
    const { gameId } = req.params;

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const players = db
      .prepare('SELECT id, username, role FROM players WHERE game_id = ? ORDER BY joined_at')
      .all(gameId);

    res.json({ game, players });
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Failed to get game' });
  }
});

// Get courses from GitHub
router.get('/courses/list', async (req, res) => {
  try {
    const response = await axios.get(
      'https://raw.githubusercontent.com/SmithMMTK/BABE_Fight/refs/heads/main/Resources/courses.json'
    );
    const enhancedCourses = response.data.map(enhanceCourseData);
    res.json(enhancedCourses);
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// Add player (Host only - ข้อ 3)
router.post('/:gameId/players', (req, res) => {
  try {
    const { gameId } = req.params;
    const { username, role } = req.body;

    if (!username || !role) {
      return res.status(400).json({ error: 'Missing username or role' });
    }

    // Check if username already exists
    const existingPlayer = db
      .prepare('SELECT * FROM players WHERE game_id = ? AND username = ?')
      .get(gameId, username);

    if (existingPlayer) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const insertPlayer = db.prepare(`
      INSERT INTO players (game_id, username, role)
      VALUES (?, ?, ?)
    `);
    const result = insertPlayer.run(gameId, username, role);

    const newPlayer = db
      .prepare('SELECT id, username, role FROM players WHERE id = ?')
      .get(result.lastInsertRowid);

    res.json(newPlayer);
  } catch (error) {
    console.error('Add player error:', error);
    res.status(500).json({ error: 'Failed to add player' });
  }
});

// Remove player (Host only - ข้อ 5)
router.delete('/:gameId/players/:playerId', (req, res) => {
  try {
    const { playerId } = req.params;

    db.prepare('DELETE FROM players WHERE id = ?').run(playerId);
    res.json({ success: true });
  } catch (error) {
    console.error('Remove player error:', error);
    res.status(500).json({ error: 'Failed to remove player' });
  }
});

// Toggle player role (Host only - ข้อ 3, 4)
router.patch('/:gameId/players/:playerId/role', (req, res) => {
  try {
    const { playerId } = req.params;
    const { role } = req.body;

    if (!role || !['host', 'player'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    db.prepare('UPDATE players SET role = ? WHERE id = ?').run(role, playerId);
    res.json({ success: true, role });
  } catch (error) {
    console.error('Toggle role error:', error);
    res.status(500).json({ error: 'Failed to toggle role' });
  }
});

// Update player username (ข้อ 5 - Guest แก้ชื่อตัวเอง)
router.patch('/:gameId/players/:playerId/username', (req, res) => {
  try {
    const { playerId } = req.params;
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }

    db.prepare('UPDATE players SET username = ? WHERE id = ?').run(username, playerId);
    res.json({ success: true, username });
  } catch (error) {
    console.error('Update username error:', error);
    res.status(500).json({ error: 'Failed to update username' });
  }
});

export default router;
