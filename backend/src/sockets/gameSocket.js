import db from '../db/database.js';

export function setupGameSocket(io) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Join game room
    socket.on('join-game', (gameId) => {
      socket.join(`game-${gameId}`);
      console.log(`Socket ${socket.id} joined game-${gameId}`);
      
      // Notify others
      socket.to(`game-${gameId}`).emit('player-joined', {
        message: 'A player joined'
      });
    });

    // Player added by host
    socket.on('player-added', ({ gameId, player }) => {
      io.to(`game-${gameId}`).emit('player-added', player);
    });

    // Player removed by host
    socket.on('player-removed', ({ gameId, playerId }) => {
      io.to(`game-${gameId}`).emit('player-removed', playerId);
    });

    // Score updated
    socket.on('score-update', ({ gameId, playerId, holeNumber, score }) => {
      // Broadcast to all in game
      io.to(`game-${gameId}`).emit('score-updated', {
        playerId,
        holeNumber,
        score
      });
    });

    // Role changed
    socket.on('role-change', ({ gameId, playerId, newRole }) => {
      io.to(`game-${gameId}`).emit('role-changed', {
        playerId,
        newRole
      });
    });

    // Username changed
    socket.on('username-change', ({ gameId, playerId, newUsername }) => {
      io.to(`game-${gameId}`).emit('username-changed', {
        playerId,
        newUsername
      });
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}
