import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import gamesRouter from './routes/games.js';
import scoresRouter from './routes/scores.js';
import versionRouter from './routes/version.js';
import { setupGameSocket } from './sockets/gameSocket.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Access from network: http://<your-ip>:${PORT}`);
  console.log(`💾 Database: Azure SQL (${DB_NAME})`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
