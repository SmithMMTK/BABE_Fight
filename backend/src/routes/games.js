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
    const existingGames = await db.all('SELECT host_pin, guest_pin FROM games WHERE status = ?', ['active']);
    const existingPINs = existingGames.flatMap(g => [g.host_pin, g.guest_pin]);

    // Generate unique PINs
    const { hostPin, guestPin } = generateUniquePINs(existingPINs);

    // Create game
    const result = await db.run(`
      INSERT INTO games (host_pin, guest_pin, course_id, course_name)
      VALUES (?, ?, ?, ?)
    `, [hostPin, guestPin, courseId, courseName]);
    
    console.log('Insert game result:', result);
    const gameId = result.lastID;
    console.log('Game ID:', gameId);

    if (!gameId) {
      throw new Error('Failed to get game ID from insert');
    }

    // Add host as player
    await db.run(`
      INSERT INTO players (game_id, username, role)
      VALUES (?, ?, 'host')
    `, [gameId, hostUsername]);

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
router.post('/join', async (req, res) => {
  try {
    const { pin, username } = req.body;

    if (!pin || !username) {
      return res.status(400).json({ error: 'Missing PIN or username' });
    }

    // Find game by either host or guest PIN
    const game = await db.get(
      'SELECT * FROM games WHERE (host_pin = ? OR guest_pin = ?) AND status = ?',
      [pin, pin, 'active']
    );

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Security: Check if username exists in this game
    // Users must know BOTH the PIN AND an existing player's exact name to join
    const existingPlayer = await db.get(
      'SELECT * FROM players WHERE game_id = ? AND username = ?',
      [game.id, username]
    );

    // Reject if username doesn't match any existing player
    // This prevents unauthorized access even with correct PIN
    if (!existingPlayer) {
      return res.status(403).json({ 
        error: 'Player name not found',
        message: 'Username does not match any existing player in this game. Please enter the exact name of an existing player.'
      });
    }

    // Player exists - allow rejoin
    res.json({
      gameId: game.id,
      playerId: existingPlayer.id,
      hostPin: game.host_pin,
      guestPin: game.guest_pin,
      courseId: game.course_id,
      courseName: game.course_name,
      role: existingPlayer.role
    });
  } catch (error) {
    console.error('Join game error:', error);
    res.status(500).json({ error: 'Failed to join game' });
  }
});

// Get game details
router.get('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;

    const game = await db.get('SELECT * FROM games WHERE id = ?', [gameId]);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const players = await db.all(
      'SELECT id, username, role FROM players WHERE game_id = ? ORDER BY joined_at',
      [gameId]
    );

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

// Add player (Host only)
router.post('/:gameId/players', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { username, role } = req.body;

    if (!username || !role) {
      return res.status(400).json({ error: 'Missing username or role' });
    }

    // Check if username already exists
    const existingPlayer = await db.get(
      'SELECT * FROM players WHERE game_id = ? AND username = ?',
      [gameId, username]
    );

    if (existingPlayer) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const result = await db.run(`
      INSERT INTO players (game_id, username, role)
      VALUES (?, ?, ?)
    `, [gameId, username, role]);

    const newPlayer = await db.get(
      'SELECT id, username, role FROM players WHERE id = ?',
      [result.lastID]
    );

    res.json(newPlayer);
  } catch (error) {
    console.error('Add player error:', error);
    res.status(500).json({ error: 'Failed to add player' });
  }
});

// Remove player (Host only)
router.delete('/:gameId/players/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;

    await db.run('DELETE FROM players WHERE id = ?', [playerId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Remove player error:', error);
    res.status(500).json({ error: 'Failed to remove player' });
  }
});

// Toggle player role (Host only)
router.patch('/:gameId/players/:playerId/role', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { role } = req.body;

    if (!role || !['host', 'player'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    await db.run('UPDATE players SET role = ? WHERE id = ?', [role, playerId]);
    res.json({ success: true, role });
  } catch (error) {
    console.error('Toggle role error:', error);
    res.status(500).json({ error: 'Failed to toggle role' });
  }
});

// Update player username
router.patch('/:gameId/players/:playerId/username', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }

    await db.run('UPDATE players SET username = ? WHERE id = ?', [username, playerId]);
    res.json({ success: true, username });
  } catch (error) {
    console.error('Update username error:', error);
    res.status(500).json({ error: 'Failed to update username' });
  }
});

// Get turbo multipliers for a game
router.get('/:gameId/turbo', async (req, res) => {
  try {
    const { gameId } = req.params;
    
    const turbos = await db.all(
      'SELECT hole_number, multiplier FROM game_turbo WHERE game_id = ?',
      [gameId]
    );
    
    const turboMap = {};
    turbos.forEach(t => {
      turboMap[t.hole_number] = t.multiplier;
    });
    
    res.json(turboMap);
  } catch (error) {
    console.error('Get turbo error:', error);
    res.status(500).json({ error: 'Failed to get turbo values' });
  }
});

// Update turbo multiplier for a hole
router.post('/:gameId/turbo', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { holeNumber, multiplier } = req.body;

    if (!holeNumber || !multiplier) {
      return res.status(400).json({ error: 'Missing hole number or multiplier' });
    }

    // Check if using SQL Server or SQLite
    const isSQL = process.env.DB_TYPE === 'mssql';
    
    if (isSQL) {
      // SQL Server: MERGE statement
      await db.run(`
        MERGE INTO game_turbo AS target
        USING (SELECT ? AS game_id, ? AS hole_number, ? AS multiplier) AS source
        ON target.game_id = source.game_id AND target.hole_number = source.hole_number
        WHEN MATCHED THEN
          UPDATE SET multiplier = source.multiplier, updated_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (game_id, hole_number, multiplier) VALUES (source.game_id, source.hole_number, source.multiplier);
      `, [gameId, holeNumber, multiplier]);
    } else {
      // SQLite: ON CONFLICT
      await db.run(`
        INSERT INTO game_turbo (game_id, hole_number, multiplier)
        VALUES (?, ?, ?)
        ON CONFLICT(game_id, hole_number) 
        DO UPDATE SET multiplier = ?, updated_at = CURRENT_TIMESTAMP
      `, [gameId, holeNumber, multiplier, multiplier]);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update turbo error:', error);
    res.status(500).json({ error: 'Failed to update turbo value' });
  }
});

export default router;
