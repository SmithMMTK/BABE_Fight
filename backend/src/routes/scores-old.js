import express from 'express';
import db from '../db/database.js';

const router = express.Router();

// Update score
router.post('/', (req, res) => {
  try {
    const { playerId, holeNumber, score } = req.body;

    if (!playerId || !holeNumber || score === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const upsert = db.prepare(`
      INSERT INTO scores (player_id, hole_number, score)
      VALUES (?, ?, ?)
      ON CONFLICT(player_id, hole_number) 
      DO UPDATE SET score = ?, updated_at = CURRENT_TIMESTAMP
    `);
    
    upsert.run(playerId, holeNumber, score, score);

    res.json({ success: true });
  } catch (error) {
    console.error('Update score error:', error);
    res.status(500).json({ error: 'Failed to update score' });
  }
});

// Get scores for player
router.get('/player/:playerId', (req, res) => {
  try {
    const { playerId } = req.params;

    const scores = db
      .prepare('SELECT hole_number, score FROM scores WHERE player_id = ? ORDER BY hole_number')
      .all(playerId);

    res.json(scores);
  } catch (error) {
    console.error('Get scores error:', error);
    res.status(500).json({ error: 'Failed to get scores' });
  }
});

// Get all scores for a game
router.get('/game/:gameId', (req, res) => {
  try {
    const { gameId } = req.params;

    const scores = db.prepare(`
      SELECT 
        p.id as player_id,
        p.username,
        s.hole_number,
        s.score
      FROM players p
      LEFT JOIN scores s ON p.id = s.player_id
      WHERE p.game_id = ?
      ORDER BY p.joined_at, s.hole_number
    `).all(gameId);

    res.json(scores);
  } catch (error) {
    console.error('Get game scores error:', error);
    res.status(500).json({ error: 'Failed to get game scores' });
  }
});

export default router;
