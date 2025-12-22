const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// Submit or update score
router.post('/', authenticateToken, (req, res) => {
  const { gameId, holeNumber, strokes } = req.body;

  if (!gameId || !holeNumber || strokes === undefined) {
    return res.status(400).json({ error: 'gameId, holeNumber, and strokes are required' });
  }

  try {
    // Verify user is participant in the game
    const participant = db.prepare('SELECT * FROM game_participants WHERE game_id = ? AND user_id = ?').get(gameId, req.user.userId);
    
    if (!participant) {
      return res.status(403).json({ error: 'Not a participant in this game' });
    }

    // Insert or update score (UPSERT with latest timestamp wins)
    const result = db.prepare(`
      INSERT INTO scores (game_id, user_id, hole_number, strokes, updated_at) 
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(game_id, user_id, hole_number) 
      DO UPDATE SET strokes = excluded.strokes, updated_at = CURRENT_TIMESTAMP
    `).run(gameId, req.user.userId, holeNumber, strokes);

    const score = db.prepare('SELECT * FROM scores WHERE game_id = ? AND user_id = ? AND hole_number = ?').get(gameId, req.user.userId, holeNumber);

    res.json({ score });
  } catch (error) {
    console.error('Submit score error:', error);
    res.status(500).json({ error: 'Failed to submit score' });
  }
});

// Get scores for a game
router.get('/game/:gameId', authenticateToken, (req, res) => {
  try {
    const scores = db.prepare(`
      SELECT s.*, u.username 
      FROM scores s 
      JOIN users u ON s.user_id = u.id 
      WHERE s.game_id = ?
      ORDER BY s.hole_number, u.username
    `).all(req.params.gameId);

    res.json({ scores });
  } catch (error) {
    console.error('Get scores error:', error);
    res.status(500).json({ error: 'Failed to retrieve scores' });
  }
});

module.exports = router;
