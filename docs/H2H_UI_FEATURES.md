# H2H Scoring UI Features

## Overview
Visual indicators and interactive elements for Head-to-Head scoring display on the gameplay scorecard.

## Features Implemented

### 1. H2H Indicators (Per-Hole Win/Loss)

**Location:** Top-left corner of opponent score cells

**Display Format:**
- **Win:** 🎯 repeated by point value (e.g., 🎯🎯🎯🎯 for +4 points)
- **Loss:** ⚠️ repeated by point value (e.g., ⚠️⚠️ for -2 points)
- **Tie/Pending:** No indicator shown

**Example:**
```
Hole 1 (Par 4, x2 Turbo):
- Player: 4 (Par)
- Opponent: 3 (Birdie)
- Opponent's cell shows: 🎯🎯🎯🎯 (Player won 4 points: 2 base × 2 turbo)
```

**Implementation:**
- File: `frontend/src/pages/GamePlay.jsx`
- Function: `getH2HIndicator(viewPlayerId, opponentId, holeNumber)`
- Display: `emoji.repeat(absValue)` where absValue = Math.abs(playerDelta)

**Style:**
```css
position: absolute;
top: 2px;
left: 2px;
fontSize: 0.75rem;
fontWeight: bold;
zIndex: 10;
textShadow: 0 0 2px white;
```

---

### 2. Score Input Modal

**Purpose:** Replace native select dropdown for better mobile UX and golf terminology display

**Features:**
- Click existing score to edit (no longer resets to "-")
- Full-screen overlay modal
- Grid layout with all score options (1-10)
- Two-line display:
  - **Line 1:** Score number (large)
  - **Line 2:** Golf terminology (Par, Birdie, Bogey, etc.)

**Golf Score Names:**
```javascript
const scoreNames = {
  [par - 3]: 'Albatross',
  [par - 2]: 'Eagle',
  [par - 1]: 'Birdie',
  [par]: 'Par',
  [par + 1]: 'Bogey',
  [par + 2]: 'Double Bogey',
  [par + 3]: 'Triple Bogey'
};

// Hole-in-One special case
if (par === 3 && score === 1) {
  name = 'HIO';
}
```

**Implementation:**
- File: `frontend/src/pages/GamePlay.jsx` (lines 750-805)
- Styling: `frontend/src/pages/GamePlay.css` (lines 617-722)
- State: `editingScoreCell` tracks which cell is being edited

**Close Actions:**
- Click overlay background
- Select a score option
- Press "ยกเลิก" button

---

### 3. H2H Totals Display

**Location:** Below score totals in Total rows (Front 9, Back 9, Grand Total)

**Format:**
- **Positive:** Green text with "+" prefix (e.g., +8)
- **Negative:** Red text with "-" prefix (e.g., -3)
- **Zero:** Not displayed

**Calculation:**
```javascript
function getH2HTotalForHoles(viewPlayerId, opponentId, startHole, endHole) {
  let sum = 0;
  for (let hole = startHole; hole <= endHole; hole++) {
    const delta = getH2HIndicator(viewPlayerId, opponentId, hole);
    if (delta) sum += delta;
  }
  return sum;
}
```

**Display Locations:**
- Front 9 Total (Holes 1-9)
- Back 9 Total (Holes 10-18)
- Grand Total (Holes 1-18)

**Example:**
```
Total: 35
🎯 +6  (Player is winning by 6 points)
```

---

## Visual Evolution

### Emoji Changes
1. **v1:** 💀 (skull) for loss
2. **v2:** ❗️ (exclamation) - didn't render properly
3. **v3:** ⚠️ (warning) - final choice ✅

### Display Format Evolution
1. **v1:** Single emoji (🎯 or ⚠️)
2. **v2:** Emoji with multiplier text (e.g., "🎯 x4")
3. **v3:** Repeated emojis (e.g., "🎯🎯🎯🎯") - current ✅

**Rationale:** Repeated emojis provide immediate visual impact without requiring number reading.

---

## Technical Details

### State Management
```javascript
const [editingScoreCell, setEditingScoreCell] = useState(null);
const [turboValues, setTurboValues] = useState({});
```

### H2H Calculation Integration
- Engine: `frontend/src/utils/h2hScoring.js`
- Per-hole calculation: Called in real-time as scores are updated
- Totals: Calculated on-demand when rendering Total rows

### Performance
- Calculations cached per hole
- Only recalculate when scores change
- No unnecessary re-renders

---

## Testing Checklist

### H2H Indicators
- [ ] Win shows 🎯 repeated correctly
- [ ] Loss shows ⚠️ repeated correctly
- [ ] Tie shows no indicator
- [ ] Pending (no score) shows no indicator
- [ ] Count matches actual point value
- [ ] Visible on all opponent columns (not on viewPlayer)

### Score Modal
- [ ] Clicking existing score opens modal (doesn't reset)
- [ ] Modal shows all score options 1-10
- [ ] Golf names display correctly for each score
- [ ] Hole-in-One shows on Par 3 when score = 1
- [ ] Click overlay closes modal
- [ ] Select score updates and closes
- [ ] Cancel button closes without saving

### H2H Totals
- [ ] Front 9 total shows correct sum
- [ ] Back 9 total shows correct sum
- [ ] Grand total shows correct sum
- [ ] Positive values show green with +
- [ ] Negative values show red with -
- [ ] Zero doesn't display
- [ ] Updates in real-time as scores change

---

## Code References

**Files:**
- `frontend/src/pages/GamePlay.jsx` (main UI)
- `frontend/src/pages/GamePlay.css` (styling)
- `frontend/src/utils/h2hScoring.js` (calculation engine)

**Key Functions:**
- `getH2HIndicator(viewPlayerId, opponentId, holeNumber)` - per-hole calculation
- `getH2HTotalForHoles(viewPlayerId, opponentId, start, end)` - range sum
- `handleScoreCellClick(playerId, holeNumber)` - score editing

**Git Commits:**
- Indicators: `106d549`
- Score Modal: `25fb834`
- Repeated Emojis: `40a30c7`
- Final Merge: `4a7d4f0`
