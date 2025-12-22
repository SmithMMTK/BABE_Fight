const jwt = require('jsonwebtoken');
const db = require('../db/database');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Authenticate socket connection
    socket.on('authenticate', (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        socket.username = decoded.username;
        console.log(`User authenticated: ${socket.username}`);
      } catch (error) {
        socket.emit('error', { message: 'Authentication failed' });
        socket.disconnect();
      }
    });

    // Join a game room
    socket.on('joinGame', (gameId) => {
      if (!socket.userId) {
        return socket.emit('error', { message: 'Not authenticated' });
      }

      // Verify user is participant
      const participant = db.prepare('SELECT * FROM game_participants WHERE game_id = ? AND user_id = ?').get(gameId, socket.userId);
      
      if (!participant) {
        return socket.emit('error', { message: 'Not a participant in this game' });
      }

      socket.join(`game_${gameId}`);
      socket.gameId = gameId;
      console.log(`${socket.username} joined game ${gameId}`);
      
      // Notify others in the room
      socket.to(`game_${gameId}`).emit('playerJoined', {
        userId: socket.userId,
        username: socket.username
      });
    });

    // Handle score updates
    socket.on('scoreUpdate', (data) => {
      if (!socket.userId || !socket.gameId) {
        return socket.emit('error', { message: 'Not authenticated or not in a game' });
      }

      const { holeNumber, strokes } = data;

      try {
        // Update score in database
        db.prepare(`
          INSERT INTO scores (game_id, user_id, hole_number, strokes, updated_at) 
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(game_id, user_id, hole_number) 
          DO UPDATE SET strokes = excluded.strokes, updated_at = CURRENT_TIMESTAMP
        `).run(socket.gameId, socket.userId, holeNumber, strokes);

        const score = db.prepare('SELECT * FROM scores WHERE game_id = ? AND user_id = ? AND hole_number = ?').get(socket.gameId, socket.userId, holeNumber);

        // Broadcast to all players in the game (including sender for confirmation)
        io.to(`game_${socket.gameId}`).emit('scoreUpdated', {
          ...score,
          username: socket.username
        });
      } catch (error) {
        console.error('Score update error:', error);
        socket.emit('error', { message: 'Failed to update score' });
      }
    });

    // Request full game state
    socket.on('requestGameState', () => {
      if (!socket.gameId) {
        return socket.emit('error', { message: 'Not in a game' });
      }

      try {
        const scores = db.prepare(`
          SELECT s.*, u.username 
          FROM scores s 
          JOIN users u ON s.user_id = u.id 
          WHERE s.game_id = ?
          ORDER BY s.hole_number, u.username
        `).all(socket.gameId);

        const participants = db.prepare(`
          SELECT u.id, u.username, gp.role 
          FROM game_participants gp 
          JOIN users u ON gp.user_id = u.id 
          WHERE gp.game_id = ?
        `).all(socket.gameId);

        socket.emit('gameState', { scores, participants });
      } catch (error) {
        console.error('Get game state error:', error);
        socket.emit('error', { message: 'Failed to retrieve game state' });
      }
    });

    // Leave game room
    socket.on('leaveGame', () => {
      if (socket.gameId) {
        socket.to(`game_${socket.gameId}`).emit('playerLeft', {
          userId: socket.userId,
          username: socket.username
        });
        socket.leave(`game_${socket.gameId}`);
        console.log(`${socket.username} left game ${socket.gameId}`);
        socket.gameId = null;
      }
    });

    socket.on('disconnect', () => {
      if (socket.gameId) {
        socket.to(`game_${socket.gameId}`).emit('playerLeft', {
          userId: socket.userId,
          username: socket.username
        });
      }
      console.log('Client disconnected:', socket.id);
    });
  });
};
