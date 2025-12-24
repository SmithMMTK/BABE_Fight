# H2H Scoring Configuration - Testing Guide

## Overview
This feature allows the Host to configure point values for Head-to-Head scoring. All players receive the same configuration values in real-time.

## Default Values
```json
{
  "holeInOne": 10,
  "eagle": 5,
  "birdie": 2,
  "parOrWorse": 1
}
```

## Database Setup

### Run Migration
Before testing, create the `game_scoring_config` table:

```bash
# If using Docker SQL
docker exec -i <container-name> /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "YourStrong@Passw0rd" -C \
  -d BABE_Fight -i /dev/stdin < backend/create-scoring-config-table.sql

# Or connect to Azure SQL and run:
sqlcmd -S <server>.database.windows.net -U <user> -P <password> -d BABE_Fight \
  -i backend/create-scoring-config-table.sql
```

### Verify Table
```sql
SELECT * FROM game_scoring_config;
```

## API Endpoints

### GET /api/games/:gameId/scoring-config
Returns current scoring configuration for a game.

**Response:**
```json
{
  "holeInOne": 10,
  "eagle": 5,
  "birdie": 2,
  "parOrWorse": 1
}
```

### PUT /api/games/:gameId/scoring-config
Update scoring configuration (Host only).

**Request Body:**
```json
{
  "holeInOne": 10,
  "eagle": 5,
  "birdie": 2,
  "parOrWorse": 1,
  "playerId": 123
}
```

**Response:**
```json
{
  "success": true,
  "config": {
    "holeInOne": 10,
    "eagle": 5,
    "birdie": 2,
    "parOrWorse": 1
  }
}
```

**Socket Broadcast:**
After successful update, all players in the game receive:
```javascript
socket.on('scoring-config-updated', (config) => {
  // config = { holeInOne, eagle, birdie, parOrWorse }
});
```

## Testing Checklist

### Initial Load
- [ ] Start a new game as Host
- [ ] Default config loads automatically (10, 5, 2, 1)
- [ ] Config saved to database
- [ ] All players see same values

### Host Access
- [ ] Open hamburger menu as Host
- [ ] "H2H Scoring Config" menu item visible
- [ ] Click opens modal with current values
- [ ] Modal shows emoji icons (🎯🦅🐦⛳)

### Guest Access
- [ ] Open hamburger menu as Guest
- [ ] "H2H Scoring Config" menu item NOT visible
- [ ] Guest cannot modify config

### Edit Config (Host)
- [ ] Change values in form
- [ ] All inputs accept numbers only
- [ ] Min value is 0
- [ ] "รีเซ็ตค่าเริ่มต้น" button resets to defaults
- [ ] "ยกเลิก" button closes without saving
- [ ] "บันทึก" button saves and broadcasts

### Real-time Sync
- [ ] Host updates config
- [ ] All connected players receive update immediately
- [ ] Player on different device sees update
- [ ] No need to refresh browser
- [ ] Console shows: "Scoring config updated: {...}"

### Validation
- [ ] Cannot save negative numbers
- [ ] Cannot save non-numeric values
- [ ] Form validates before API call
- [ ] Error message if save fails

### Database Persistence
- [ ] Config saved to game_scoring_config table
- [ ] Refresh browser - config still loaded
- [ ] New player joins - sees same config
- [ ] Game restart - config persists

## Test Scenarios

### Scenario 1: New Game
1. Create game as Host
2. Check console: "Loaded scoring config: {holeInOne: 10, ...}"
3. Open database: Row exists in game_scoring_config
4. Join as Guest: Same config loaded

### Scenario 2: Update Config
1. Host opens hamburger menu
2. Click "H2H Scoring Config"
3. Change values (e.g., holeInOne: 15)
4. Click "บันทึก"
5. Modal closes
6. Guest device: Console shows "Scoring config updated"
7. Database: Row updated with new values

### Scenario 3: Multiple Players
1. Host + 3 Guests connected
2. Host updates config
3. All 4 players log config update in console
4. Verify all have same values in state

### Scenario 4: Connection Issues
1. Guest disconnects (turn off wifi)
2. Host updates config
3. Guest reconnects
4. Guest receives latest config on page load

## Code References

### Frontend Files
- `Resources/h2h-scoring-config.json` - Default values
- `frontend/src/services/api.js` - API functions
- `frontend/src/pages/GamePlay.jsx` - State management, socket listener
- `frontend/src/components/ScoringConfigModal.jsx` - Edit modal
- `frontend/src/components/ScoringConfigModal.css` - Modal styles
- `frontend/src/components/PlayersMenu.jsx` - Menu item

### Backend Files
- `backend/create-scoring-config-table.sql` - Database migration
- `backend/src/routes/games.js` - API endpoints (lines 447-566)

### Key State Variables
```javascript
const [scoringConfig, setScoringConfig] = useState(null);
const [showScoringConfigModal, setShowScoringConfigModal] = useState(false);
```

### Socket Events
```javascript
// Listen for updates
socket.on('scoring-config-updated', handleScoringConfigUpdate);

// Broadcast from backend
io.to(`game-${gameId}`).emit('scoring-config-updated', updatedConfig);
```

## Troubleshooting

### Config not loading
- Check console for API errors
- Verify game_scoring_config table exists
- Check database connection
- Verify gameId is correct

### Real-time not working
- Check socket connection (console logs)
- Verify both players in same game room
- Check browser console for socket errors
- Restart backend server

### Host cannot save
- Verify player has role='host'
- Check playerId passed in request
- Check database constraints
- Verify API endpoint URL

### Values not persisting
- Check database table has row
- Verify ON DELETE CASCADE on foreign key
- Check updated_at timestamp changes
- Verify transaction commits

## Next Steps
After scoring configuration is working:
1. Implement H2H score calculation per hole
2. Calculate win/loss based on net scores
3. Apply turbo multipliers to scoring
4. Display match results in summary section
5. Add match play standings
