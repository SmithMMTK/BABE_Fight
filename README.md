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
./run-local.sh

# Access application
Frontend: http://localhost:5173
Backend: http://localhost:8080
```

## Production Deployment

See [AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md) for complete deployment guide.

### Quick Deploy to Azure

```bash
# Build frontend
npm run build

# Deploy
npm start
```

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── server.js          # Express + Socket.IO server
│   │   ├── routes/            # API routes
│   │   ├── sockets/           # WebSocket handlers
│   │   └── db/                # SQLite database
│   └── data/                  # Database files
├── frontend/
│   ├── src/
│   │   ├── pages/             # React pages
│   │   ├── components/        # React components
│   │   ├── services/          # API service
│   │   └── context/           # Socket context
│   └── dist/                  # Production build
├── Resources/                 # Course data & configs
├── startup.sh                 # Azure startup script
├── web.config                 # IIS configuration
└── AZURE_DEPLOYMENT.md        # Deployment guide
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
