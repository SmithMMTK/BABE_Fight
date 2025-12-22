const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { generateEasyPin, generateGameCode } = require('../utils/pinGenerator');

// Get available courses
router.get('/courses', authenticateToken, (req, res) => {
  try {
    const courses = db.prepare('SELECT * FROM courses ORDER BY name').all();
    res.json({ courses });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Failed to retrieve courses' });
  }
});

// Create a new game (HOST only)
router.post('/', authenticateToken, (req, res) => {
  try {
    const { courseId } = req.body;
    
    const gameCode = generateGameCode();
    const hostPin = generateEasyPin(4);
    const guestPin = generateEasyPin(4);
    
    const result = db.prepare(
      'INSERT INTO games (game_code, host_pin, guest_pin, host_id, course_id) VALUES (?, ?, ?, ?, ?)'
    ).run(gameCode, hostPin, guestPin, req.user.userId, courseId || null);
    
    // Add host as participant
    db.prepare('INSERT INTO game_participants (game_id, user_id, role) VALUES (?, ?, ?)').run(result.lastInsertRowid, req.user.userId, 'HOST');

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(result.lastInsertRowid);
    
    res.json({ game, hostPin, guestPin });
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Join a game with PIN
router.post('/join', authenticateToken, (req, res) => {
  const { pin } = req.body;

  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }

  try {
    // Find game by either host_pin or guest_pin
    const game = db.prepare(
      'SELECT * FROM games WHERE (host_pin = ? OR guest_pin = ?) AND status = ?'
    ).get(pin, pin, 'active');
    
    if (!game) {
      return res.status(404).json({ error: 'Invalid PIN or game not found' });
    }

    // Check if already joined
    const existing = db.prepare('SELECT * FROM game_participants WHERE game_id = ? AND user_id = ?').get(game.id, req.user.userId);
    
    if (existing) {
      return res.json({ game, role: existing.role, message: 'Already joined this game' });
    }

    // Determine role based on PIN
    const role = (pin === game.host_pin) ? 'CO-HOST' : 'GUEST';

    // Add as participant
    db.prepare('INSERT INTO game_participants (game_id, user_id, role) VALUES (?, ?, ?)').run(game.id, req.user.userId, role);

    res.json({ game, role, message: `Joined game successfully as ${role}` });
  } catch (error) {
    console.error('Join game error:', error);
    res.status(500).json({ error: 'Failed to join game' });
  }
});

// Get game details with participants and scores
router.get('/:gameId', authenticateToken, (req, res) => {
  try {
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.gameId);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const participants = db.prepare(`
      SELECT u.id, u.username, gp.role, gp.joined_at 
      FROM game_participants gp 
      JOIN users u ON gp.user_id = u.id 
      WHERE gp.game_id = ?
    `).all(game.id);

    const scores = db.prepare(`
      SELECT s.*, u.username 
      FROM scores s 
      JOIN users u ON s.user_id = u.id 
      WHERE s.game_id = ?
      ORDER BY s.hole_number, u.username
    `).all(game.id);

    res.json({ game, participants, scores });
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Failed to retrieve game' });
  }
});

// Update participant role (HOST and CO-HOST only)
router.put('/:gameId/participants/:userId/role', authenticateToken, (req, res) => {
  try {
    const { gameId, userId } = req.params;
    const { role } = req.body;

    // Verify requester is HOST or CO-HOST
    const requester = db.prepare(
      'SELECT role FROM game_participants WHERE game_id = ? AND user_id = ?'
    ).get(gameId, req.user.userId);

    if (!requester || (requester.role !== 'HOST' && requester.role !== 'CO-HOST')) {
      return res.status(403).json({ error: 'Only HOST or CO-HOST can assign roles' });
    }

    // Validate new role
    if (!['HOST', 'CO-HOST', 'GUEST'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Update role
    db.prepare(
      'UPDATE game_participants SET role = ? WHERE game_id = ? AND user_id = ?'
    ).run(role, gameId, userId);

    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Remove participant (HOST and CO-HOST only)
router.delete('/:gameId/participants/:userId', authenticateToken, (req, res) => {
  try {
    const { gameId, userId } = req.params;

    // Verify requester is HOST or CO-HOST
    const requester = db.prepare(
      'SELECT role FROM game_participants WHERE game_id = ? AND user_id = ?'
    ).get(gameId, req.user.userId);

    if (!requester || (requester.role !== 'HOST' && requester.role !== 'CO-HOST')) {
      return res.status(403).json({ error: 'Only HOST or CO-HOST can remove members' });
    }

    // Check if trying to remove themselves
    if (userId == req.user.userId) {
      const participantCount = db.prepare('SELECT COUNT(*) as count FROM game_participants WHERE game_id = ?').get(gameId).count;
      
      if (participantCount === 1) {
        // Last person - delete the game
        db.prepare('DELETE FROM games WHERE id = ?').run(gameId);
        return res.json({ message: 'Game deleted as last participant left' });
      }
      
      return res.status(400).json({ 
        error: 'Warning: You are removing yourself from the game. Are you sure?',
        requireConfirmation: true
      });
    }

    // Remove participant
    db.prepare('DELETE FROM game_participants WHERE game_id = ? AND user_id = ?').run(gameId, userId);
    
    // Also remove their scores
    db.prepare('DELETE FROM scores WHERE game_id = ? AND user_id = ?').run(gameId, userId);

    res.json({ message: 'Participant removed successfully' });
  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

module.exports = router;
