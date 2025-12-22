# BABE Fight - Multi-player Golf Scorecard Tracker

A real-time golf scorecard tracking application that allows multiple players to input scores and view live updates.

## Features

- **Real-time Score Sync**: Live updates across all connected devices
- **PIN-based Authentication**: Stateless login with username and PIN
- **Role-based Access**: HOST and GUEST roles for game management
- **Mobile-first Design**: Optimized for iOS and Android web browsers
- **Multi-player Support**: Multiple players can track scores simultaneously

## Project Structure

```
BABE_Fight/
├── backend/          # Node.js API server with Socket.IO
├── frontend/         # React mobile web app
├── Instructions/     # Project documentation and specifications
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Modern web browser (iOS Safari, Chrome, Android Chrome)

### Installation

```bash
# Install all dependencies (root, backend, and frontend)
npm run install:all
```

### Development

```bash
# Run both backend and frontend in development mode
npm run dev

# Or run separately:
npm run dev:backend   # Backend API on http://localhost:3001
npm run dev:frontend  # Frontend on http://localhost:3000
```

### Production Build

```bash
# Build frontend for production
npm run build

# Start production server
npm start
```

## Technology Stack

- **Backend**: Node.js, Express.js, Socket.IO, SQLite/PostgreSQL
- **Frontend**: React, Socket.IO Client, Responsive Design
- **Authentication**: PIN-based stateless authentication
- **Real-time Sync**: WebSocket (Socket.IO) with conflict resolution (latest wins)

## Documentation

See the `Instructions/` folder for detailed specifications:
- `00_InitialApplicationFrame.md` - Project overview and requirements
- `01_UI_Design.md` - UI/UX design specifications (pending)

## License

MIT
