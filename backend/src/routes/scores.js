import express from 'express';
import db from '../db/database.js';

const router = express.Router();

// Update score
router.post('/', async (req, res) => {
  try {
    const { playerId, holeNumber, score } = req.body;

    if (!playerId || !holeNumber || score === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if using SQL Server or SQLite
    const isSQL = process.env.DB_TYPE === 'mssql';
    
    if (isSQL) {
      // SQL Server: MERGE statement
      await db.run(`
        MERGE INTO scores AS target
        USING (SELECT ? AS player_id, ? AS hole_number, ? AS score) AS source
        ON target.player_id = source.player_id AND target.hole_number = source.hole_number
        WHEN MATCHED THEN
          UPDATE SET score = source.score, updated_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (player_id, hole_number, score) VALUES (source.player_id, source.hole_number, source.score);
      `, [playerId, holeNumber, score]);
    } else {
      // SQLite: ON CONFLICT
      await db.run(`
        INSERT INTO scores (player_id, hole_number, score)
        VALUES (?, ?, ?)
        ON CONFLICT(player_id, hole_number) 
        DO UPDATE SET score = ?, updated_at = CURRENT_TIMESTAMP
      `, [playerId, holeNumber, score, score]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update score error:', error);
    res.status(500).json({ error: 'Failed to update score' });
  }
});

// Get scores for player
router.get('/player/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;

    const scores = await db.all(
      'SELECT hole_number, score FROM scores WHERE player_id = ? ORDER BY hole_number',
      [playerId]
    );

    res.json(scores);
  } catch (error) {
    console.error('Get scores error:', error);
    res.status(500).json({ error: 'Failed to get scores' });
  }
});

// Get all scores for a game
router.get('/game/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;

    const scores = await db.all(`
      SELECT 
        p.id as player_id,
        p.username,
        s.hole_number,
        s.score
      FROM players p
      LEFT JOIN scores s ON p.id = s.player_id
      WHERE p.game_id = ?
      ORDER BY p.joined_at, s.hole_number
    `, [gameId]);

    res.json(scores);
  } catch (error) {
    console.error('Get game scores error:', error);
    res.status(500).json({ error: 'Failed to get game scores' });
  }
});

export default router;
