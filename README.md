# BABE Fight - Golf Scorecard Tracker

Multi-player real-time golf scorecard application with WebSocket synchronization.

## Features

- ✅ Real-time score updates across all devices
- ✅ Multi-player support (HOST + guests)
- ✅ Turbo holes (2x, 3x multipliers)
- ✅ Role management (HOST/Player)
- ✅ Mobile-responsive design
- ✅ Network play support (WiFi/LAN)

## Tech Stack

- **Frontend**: React 18, Vite, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO, SQLite
- **Deployment**: Azure Web App

## Quick Start (Local Development)

```bash
# Run the project
./scripts/run-local.sh

# Access application
Frontend: http://localhost:5173
Backend: http://localhost:8080
```

## Production Deployment

See [docs/AZURE_ARCHITECTURE.md](./docs/AZURE_ARCHITECTURE.md) for complete architecture documentation.

### Deploy to Azure Container Apps

```bash
# Initial deployment (first time)
./scripts/deploy-container-apps.sh

# Update after code changes
./scripts/update-app.sh
```

See [scripts/README.md](./scripts/README.md) for all available deployment scripts.

## Project Structure

```
├── backend/                   # Node.js backend server
│   ├── src/
│   │   ├── server.js          # Express + Socket.IO server
│   │   ├── routes/            # API routes (games, scores)
│   │   ├── sockets/           # WebSocket handlers
│   │   ├── middleware/        # Express middleware
│   │   ├── utils/             # Utilities (PIN generator)
│   │   └── db/                # SQLite database layer
│   └── data/                  # SQLite database files (persistent)
│
├── frontend/                  # React frontend
│   ├── src/
│   │   ├── pages/             # React pages (Home, CreateGame, etc.)
│   │   ├── components/        # React components (PlayersMenu)
│   │   ├── services/          # API service layer
│   │   ├── context/           # Socket.IO context
│   │   └── styles/            # CSS styles
│   ├── public/                # Static assets
│   └── dist/                  # Production build output
│
├── docs/                      # 📚 Documentation
│   ├── README.md              # Documentation index
│   ├── AZURE_ARCHITECTURE.md  # Azure deployment architecture
│   ├── CONTAINER_APPS_DEPLOY.md  # Deployment guide
│   ├── backlogs.md            # Feature backlog
│   ├── commit_log.md          # Development history
│   └── setup/Instructions/    # Implementation guides
│
├── scripts/                   # 🔧 Deployment & utility scripts
│   ├── README.md              # Scripts documentation
│   ├── deploy-container-apps.sh  # Azure Container Apps deployment
│   ├── update-app.sh          # Update deployed app
│   ├── create-azure-sql.sh    # Azure SQL setup
│   ├── run-local.sh           # Local development
│   └── setup-docker-buildx.sh # Docker configuration
│
├── Resources/                 # 📁 Game data
│   ├── courses.json           # Golf course definitions
│   └── turbo-default.json     # Default turbo configuration
│
├── Dockerfile                 # Multi-stage Docker build
├── package.json               # Root dependencies
└── README.md                  # This file
```

## Environment Variables

```env
PORT=8080
NODE_ENV=production
CORS_ORIGIN=*
```

## Real-time Features

All synced via WebSocket:
- Score updates
- Player add/remove
- Username changes
- Role changes (HOST/Player)
- Turbo multiplier adjustments

## License

ISC
