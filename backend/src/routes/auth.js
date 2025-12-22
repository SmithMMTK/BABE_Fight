const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');

// Login with username and PIN
router.post('/login', (req, res) => {
  const { username, pin } = req.body;

  if (!username || !pin) {
    return res.status(400).json({ error: 'Username and PIN are required' });
  }

  try {
    // Check if user exists
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (user) {
      // Verify PIN
      const validPin = bcrypt.compareSync(pin, user.pin);
      if (!validPin) {
        return res.status(401).json({ error: 'Invalid PIN' });
      }
    } else {
      // Create new user (stateless - auto-register)
      const hashedPin = bcrypt.hashSync(pin, 10);
      const result = db.prepare('INSERT INTO users (username, pin) VALUES (?, ?)').run(username, hashedPin);
      const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
      
      const token = jwt.sign(
        { userId: newUser.id, username: newUser.username },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        token,
        user: { id: newUser.id, username: newUser.username }
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
