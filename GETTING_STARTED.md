# Getting Started Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   npm run install:all
   ```

2. **Set up environment variables:**
   ```bash
   # Backend
   cp backend/.env.example backend/.env
   
   # Frontend
   cp frontend/.env.example frontend/.env
   ```

3. **Start development servers:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Mobile access: Use your computer's local IP (e.g., http://192.168.1.x:3000)

## Project Features

✅ **Implemented Features:**
- PIN-based authentication (stateless)
- HOST and GUEST roles
- Real-time score synchronization via WebSockets
- Mobile-responsive UI
- Create and join games with unique codes
- Multi-player scorecard (18 holes)
- Latest-wins conflict resolution
- Auto-refresh data sync

## Technology Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Real-time:** Socket.IO
- **Database:** SQLite (better-sqlite3)
- **Authentication:** JWT + bcrypt

### Frontend
- **Framework:** React 18
- **Build Tool:** Vite
- **Routing:** React Router v6
- **Real-time:** Socket.IO Client
- **HTTP Client:** Axios

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login or auto-register

### Games
- `POST /api/games` - Create new game (HOST)
- `POST /api/games/join` - Join game (GUEST)
- `GET /api/games/:gameId` - Get game details

### Scores
- `POST /api/scores` - Submit/update score
- `GET /api/scores/game/:gameId` - Get all scores for game

### WebSocket Events
- `authenticate` - Authenticate socket connection
- `joinGame` - Join game room
- `scoreUpdate` - Update player score
- `scoreUpdated` - Broadcast score update
- `requestGameState` - Get full game state
- `leaveGame` - Leave game room

## Development Notes

### Testing on Mobile Devices

1. Find your computer's local IP:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet "
   
   # Windows
   ipconfig
   ```

2. Update frontend/.env:
   ```
   VITE_API_URL=http://YOUR_IP:3001
   VITE_SOCKET_URL=http://YOUR_IP:3001
   ```

3. Access from mobile: `http://YOUR_IP:3000`

### Database

SQLite database is automatically created at `backend/data/babe-fight.db` on first run. No setup required.

## Next Steps

- [ ] Add hole par information
- [ ] Implement game completion/history
- [ ] Add player statistics
- [ ] Improve error handling and validation
- [ ] Add unit and integration tests
- [ ] Deploy to production
