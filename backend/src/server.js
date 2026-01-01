// Load environment variables FIRST before any imports
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const result = dotenv.config({ path: path.join(__dirname, '../.env') });
console.log('dotenv.config result:', result);
console.log('ENV after dotenv:', {
  DB_SERVER: process.env.DB_SERVER,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER
});

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import gamesRouter from './routes/games.js';
import scoresRouter from './routes/scores.js';
import versionRouter from './routes/version.js';
import animalsRouter from './routes/animals.js';
import { setupGameSocket } from './sockets/gameSocket.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Make io accessible to routes
app.set('io', io);

// API Routes
app.use('/api/games', gamesRouter);
app.use('/api/games', animalsRouter);
app.use('/api/scores', scoresRouter);
app.use('/api/version', versionRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static files in production
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  }
});

// Socket.IO
setupGameSocket(io);

const PORT = process.env.PORT || 8080;
const DB_NAME = process.env.DB_NAME || 'babefightdb';

console.log('Starting server...');
console.log('Environment:', {
  PORT,
  DB_NAME,
  DB_SERVER: process.env.DB_SERVER,
  NODE_ENV: process.env.NODE_ENV
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
  console.log(`📊 Database: ${DB_NAME}`);
});
