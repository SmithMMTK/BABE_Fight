import express from 'express';
import db from '../db/database-mssql.js';
import { generateUniquePINs } from '../utils/pinGenerator.js';
import { calculateStrokeAllocation } from '../utils/strokeAllocation.js';
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
    const { courseId, courseName, hostUsername, hostHandicap } = req.body;

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

    // Add host as player with handicap
    const handicap = hostHandicap !== undefined ? hostHandicap : 0;
    await db.run(`
      INSERT INTO players (game_id, username, role, handicap)
      VALUES (?, ?, 'host', ?)
    `, [gameId, hostUsername, handicap]);

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

// Get courses from GitHub (must come before /:gameId)
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

// Get handicap matrix and stroke allocation for a game (must come before /:gameId)
router.get('/:gameId/handicap-matrix', async (req, res) => {
  try {
    const { gameId } = req.params;

    // Get all players
    const players = await db.all(
      'SELECT id, username, role, handicap FROM players WHERE game_id = ? ORDER BY joined_at',
      [gameId]
    );

    if (!players || players.length === 0) {
      return res.json({ players: [], handicapMatrix: {}, strokeAllocation: {} });
    }

    // Get H2H handicap data
    const h2hData = await db.all(
      'SELECT from_player_id, to_player_id, front9_strokes, back9_strokes FROM game_handicap_h2h WHERE game_id = ?',
      [gameId]
    );

    // Build handicap matrix
    const handicapMatrix = {};
    players.forEach(fromPlayer => {
      handicapMatrix[fromPlayer.id] = {};
      players.forEach(toPlayer => {
        if (fromPlayer.id !== toPlayer.id) {
          const h2hRecord = h2hData.find(
            h => h.from_player_id === fromPlayer.id && h.to_player_id === toPlayer.id
          );
          handicapMatrix[fromPlayer.id][toPlayer.id] = {
            front9: h2hRecord?.front9_strokes || 0,
            back9: h2hRecord?.back9_strokes || 0
          };
        }
      });
    });

    res.json({
      players: players.map(p => ({ id: p.id, username: p.username, handicap: p.handicap })),
      handicapMatrix
    });
  } catch (error) {
    console.error('Get handicap matrix error:', error);
    res.status(500).json({ error: 'Failed to get handicap matrix' });
  }
});

// Update handicap matrix (must come before /:gameId)
router.post('/:gameId/handicap-matrix', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { handicapMatrix } = req.body;

    if (!handicapMatrix) {
      return res.status(400).json({ error: 'Missing handicap matrix' });
    }

    // Verify game exists
    const game = await db.get('SELECT id FROM games WHERE id = ?', [gameId]);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Update each player pair using SQL Server MERGE
    for (const fromPlayerId in handicapMatrix) {
      for (const toPlayerId in handicapMatrix[fromPlayerId]) {
        const { front9, back9 } = handicapMatrix[fromPlayerId][toPlayerId];
        
        await db.run(`
          MERGE INTO game_handicap_h2h AS target
          USING (SELECT ? AS game_id, ? AS from_player_id, ? AS to_player_id, ? AS front9_strokes, ? AS back9_strokes) AS source
          ON target.game_id = source.game_id 
            AND target.from_player_id = source.from_player_id 
            AND target.to_player_id = source.to_player_id
          WHEN MATCHED THEN
            UPDATE SET front9_strokes = source.front9_strokes, back9_strokes = source.back9_strokes, updated_at = GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (game_id, from_player_id, to_player_id, front9_strokes, back9_strokes)
            VALUES (source.game_id, source.from_player_id, source.to_player_id, source.front9_strokes, source.back9_strokes);
        `, [gameId, fromPlayerId, toPlayerId, front9, back9]);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update handicap matrix error:', error);
    res.status(500).json({ error: 'Failed to update handicap matrix' });
  }
});

// Get game details (must come after specific routes)
router.get('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;

    const game = await db.get('SELECT * FROM games WHERE id = ?', [gameId]);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const players = await db.all(
      'SELECT id, username, role, handicap FROM players WHERE game_id = ? ORDER BY joined_at',
      [gameId]
    );

    res.json({ game, players });
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Failed to get game' });
  }
});

// Add player (Host only)
router.post('/:gameId/players', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { username, role, handicap } = req.body;

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

    const playerHandicap = handicap !== undefined ? handicap : 0;
    const result = await db.run(`
      INSERT INTO players (game_id, username, role, handicap)
      VALUES (?, ?, ?, ?)
    `, [gameId, username, role, playerHandicap]);

    const newPlayer = await db.get(
      'SELECT id, username, role, handicap FROM players WHERE id = ?',
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
    const { gameId, playerId } = req.params;

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
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update turbo error:', error);
    res.status(500).json({ error: 'Failed to update turbo value' });
  }
});

// Update player handicap
router.post('/:gameId/players/:playerId/handicap', async (req, res) => {
  try {
    const { gameId, playerId } = req.params;
    const { handicap } = req.body;

    if (handicap === undefined || handicap === null) {
      return res.status(400).json({ error: 'Missing handicap value' });
    }

    // Validate handicap range (0-54)
    if (handicap < 0 || handicap > 54) {
      return res.status(400).json({ error: 'Handicap must be between 0 and 54' });
    }

    // Verify player belongs to this game
    const player = await db.get(
      'SELECT * FROM players WHERE id = ? AND game_id = ?',
      [playerId, gameId]
    );

    if (!player) {
      return res.status(404).json({ error: 'Player not found in this game' });
    }

    // Update handicap
    await db.run(
      'UPDATE players SET handicap = ? WHERE id = ?',
      [handicap, playerId]
    );

    res.json({ success: true, playerId, handicap });
  } catch (error) {
    console.error('Update handicap error:', error);
    res.status(500).json({ error: 'Failed to update handicap' });
  }
});

// Load default scoring config
const defaultScoringConfigPath = join(__dirname, '../../../Resources/h2h-scoring-config.json');
let defaultScoringConfig = { holeInOne: 10, eagle: 5, birdie: 2, parOrWorse: 1 };
try {
  defaultScoringConfig = JSON.parse(fs.readFileSync(defaultScoringConfigPath, 'utf8'));
} catch (err) {
  console.warn('Failed to load default scoring config, using hardcoded defaults');
}

// GET /games/:gameId/scoring-config - Get H2H scoring configuration
router.get('/:gameId/scoring-config', async (req, res) => {
  try {
    const { gameId } = req.params;

    // Check if game exists
    const game = await db.get('SELECT * FROM games WHERE id = ?', [gameId]);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Get scoring config from database
    const config = await db.get(
      'SELECT hole_in_one, eagle, birdie, par_or_worse FROM game_scoring_config WHERE game_id = ?',
      [gameId]
    );

    if (config) {
      // Return existing config
      res.json({
        holeInOne: config.hole_in_one,
        eagle: config.eagle,
        birdie: config.birdie,
        parOrWorse: config.par_or_worse
      });
    } else {
      // Return default config and create entry in database
      const pool = await db.getPool();
      const request = pool.request();
      await request
        .input('gameId', gameId)
        .input('holeInOne', defaultScoringConfig.holeInOne)
        .input('eagle', defaultScoringConfig.eagle)
        .input('birdie', defaultScoringConfig.birdie)
        .input('parOrWorse', defaultScoringConfig.parOrWorse)
        .query('INSERT INTO game_scoring_config (game_id, hole_in_one, eagle, birdie, par_or_worse) VALUES (@gameId, @holeInOne, @eagle, @birdie, @parOrWorse)');
      
      console.log('[Scoring Config] Created default config for game', gameId);
      res.json(defaultScoringConfig);
    }
  } catch (error) {
    console.error('Get scoring config error:', error);
    res.status(500).json({ error: 'Failed to get scoring configuration' });
  }
});

// PUT /games/:gameId/scoring-config - Update H2H scoring configuration (Host only)
router.put('/:gameId/scoring-config', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { holeInOne, eagle, birdie, parOrWorse, playerId } = req.body;

    // Validate required fields
    if (holeInOne === undefined || eagle === undefined || birdie === undefined || parOrWorse === undefined || !playerId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate that values are positive integers
    if (holeInOne < 0 || eagle < 0 || birdie < 0 || parOrWorse < 0) {
      return res.status(400).json({ error: 'All values must be positive integers' });
    }

    // Check if game exists
    const game = await db.get('SELECT * FROM games WHERE id = ?', [gameId]);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Verify player is the host
    const player = await db.get(
      'SELECT * FROM players WHERE id = ? AND game_id = ? AND role = ?',
      [playerId, gameId, 'host']
    );

    if (!player) {
      return res.status(403).json({ error: 'Only the host can update scoring configuration' });
    }

    // Update or insert scoring config
    const existingConfig = await db.get(
      'SELECT * FROM game_scoring_config WHERE game_id = ?',
      [gameId]
    );

    const pool = await db.getPool();
    const request = pool.request();
    request
      .input('gameId', gameId)
      .input('holeInOne', holeInOne)
      .input('eagle', eagle)
      .input('birdie', birdie)
      .input('parOrWorse', parOrWorse);
    
    if (existingConfig) {
      await request.query(
        'UPDATE game_scoring_config SET hole_in_one = @holeInOne, eagle = @eagle, birdie = @birdie, par_or_worse = @parOrWorse, updated_at = GETDATE() WHERE game_id = @gameId'
      );
      console.log('[Scoring Config] Updated config for game', gameId);
    } else {
      await request.query(
        'INSERT INTO game_scoring_config (game_id, hole_in_one, eagle, birdie, par_or_worse) VALUES (@gameId, @holeInOne, @eagle, @birdie, @parOrWorse)'
      );
      console.log('[Scoring Config] Created new config for game', gameId);
    }

    const updatedConfig = {
      holeInOne,
      eagle,
      birdie,
      parOrWorse
    };

    // Broadcast update to all players in the game via Socket.IO
    const io = req.app.get('io');
    console.log('[Scoring Config] Broadcasting to game-' + gameId, updatedConfig);
    console.log('[Scoring Config] IO exists?', !!io);
    if (io) {
      io.to(`game-${gameId}`).emit('scoring-config-updated', updatedConfig);
      console.log('[Scoring Config] Broadcast sent successfully');
    } else {
      console.error('[Scoring Config] IO not found! Cannot broadcast');
    }

    res.json({ success: true, config: updatedConfig });
  } catch (error) {
    console.error('Update scoring config error:', error);
    res.status(500).json({ error: 'Failed to update scoring configuration' });
  }
});

export default router;
