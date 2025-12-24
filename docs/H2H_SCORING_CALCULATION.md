# H2H Scoring Calculation - Implementation Guide

## Scoring Logic Overview

When calculating H2H scores, points are awarded based on:
1. **Win Condition**: The score achieved when winning (hole-in-one, eagle, birdie, par or worse)
2. **Turbo Multiplier**: The hole's turbo value (1x, 2x, or 3x)
3. **Net Score**: Raw score minus handicap strokes

## Point Calculation Formula

```
Points = ScoringConfig[WinCondition] × TurboMultiplier
```

### Win Conditions

| Condition | Score vs Par | Default Points | Example (Par 4) |
|-----------|--------------|----------------|-----------------|
| Hole-in-One | -3 or better on Par 4+ | 10 | Score: 1 |
| Eagle | -2 | 5 | Score: 2 |
| Birdie | -1 | 2 | Score: 3 |
| Par or Worse | 0, +1, +2, ... | 1 | Score: 4, 5, 6, ... |

## Implementation Example

### Step 1: Get Net Scores
```javascript
function getNetScore(rawScore, handicapStrokes) {
  return rawScore - handicapStrokes;
}

// Example: Player A raw score = 5, receives 1 stroke
// Net score = 5 - 1 = 4
```

### Step 2: Determine Win Condition
```javascript
function getWinCondition(netScore, par) {
  const scoreToPar = netScore - par;
  
  if (netScore === 1) {
    return 'holeInOne';
  } else if (scoreToPar === -2) {
    return 'eagle';
  } else if (scoreToPar === -1) {
    return 'birdie';
  } else {
    return 'parOrWorse';
  }
}

// Example: Net score = 4, Par = 4
// Score to par = 0 → 'parOrWorse'
```

### Step 3: Compare Players and Award Points
```javascript
function calculateH2HResult(playerA, playerB, hole, scoringConfig, turboMultiplier) {
  // Get net scores
  const netA = getNetScore(
    playerA.rawScore, 
    playerA.handicapStrokes[hole.number]
  );
  const netB = getNetScore(
    playerB.rawScore, 
    playerB.handicapStrokes[hole.number]
  );
  
  // Determine winner
  if (netA < netB) {
    // Player A wins
    const winCondition = getWinCondition(netA, hole.par);
    const basePoints = scoringConfig[winCondition];
    const points = basePoints * turboMultiplier;
    
    return {
      winner: 'A',
      pointsA: points,
      pointsB: 0,
      winCondition,
      basePoints,
      turboMultiplier
    };
  } else if (netB < netA) {
    // Player B wins
    const winCondition = getWinCondition(netB, hole.par);
    const basePoints = scoringConfig[winCondition];
    const points = basePoints * turboMultiplier;
    
    return {
      winner: 'B',
      pointsA: 0,
      pointsB: points,
      winCondition,
      basePoints,
      turboMultiplier
    };
  } else {
    // Tie (halved)
    return {
      winner: null,
      pointsA: 0,
      pointsB: 0,
      winCondition: 'tie'
    };
  }
}
```

### Step 4: Apply to All Holes
```javascript
function calculateMatchResult(playerA, playerB, holes, scoringConfig, turboValues) {
  let totalPointsA = 0;
  let totalPointsB = 0;
  const holeResults = [];
  
  holes.forEach(hole => {
    const turboMultiplier = turboValues[hole.number] || 1;
    
    const result = calculateH2HResult(
      { 
        rawScore: playerA.scores[hole.number],
        handicapStrokes: playerA.h2hHandicap[playerB.id]
      },
      { 
        rawScore: playerB.scores[hole.number],
        handicapStrokes: playerB.h2hHandicap[playerA.id]
      },
      hole,
      scoringConfig,
      turboMultiplier
    );
    
    totalPointsA += result.pointsA;
    totalPointsB += result.pointsB;
    holeResults.push(result);
  });
  
  return {
    totalPointsA,
    totalPointsB,
    margin: totalPointsA - totalPointsB,
    holeResults
  };
}
```

## Example Calculation

### Scenario
- **Hole 1** (Par 4, Turbo 2x)
- **Player A**: Raw Score = 4, Handicap Strokes = 0 → Net = 4
- **Player B**: Raw Score = 5, Handicap Strokes = 1 → Net = 4
- **Result**: Tie (halved) → 0 points each

### Scenario 2
- **Hole 2** (Par 4, Turbo 1x)
- **Player A**: Raw Score = 3, Handicap Strokes = 0 → Net = 3 (Birdie)
- **Player B**: Raw Score = 5, Handicap Strokes = 0 → Net = 5
- **Result**: A wins with Birdie → A gets 2 points (2 × 1x)

### Scenario 3
- **Hole 3** (Par 5, Turbo 3x)
- **Player A**: Raw Score = 3, Handicap Strokes = 0 → Net = 3 (Eagle)
- **Player B**: Raw Score = 4, Handicap Strokes = 0 → Net = 4
- **Result**: A wins with Eagle → A gets 15 points (5 × 3x)

## Integration with Existing Code

### Where to Add Scoring Calculation

In `GamePlay.jsx`, add scoring calculation when both players have entered scores:

```javascript
// After score is updated
useEffect(() => {
  if (!scoringConfig || !course || !turboValues) return;
  
  // Calculate H2H results for all player pairs
  const results = {};
  
  players.forEach((playerA, i) => {
    players.slice(i + 1).forEach(playerB => {
      const matchResult = calculateMatchResult(
        {
          id: playerA.id,
          scores: scores[playerA.id] || {},
          h2hHandicap: h2hStrokeAllocation?.[playerA.id] || {}
        },
        {
          id: playerB.id,
          scores: scores[playerB.id] || {},
          h2hHandicap: h2hStrokeAllocation?.[playerB.id] || {}
        },
        course.holes,
        scoringConfig,
        turboValues
      );
      
      results[`${playerA.id}-${playerB.id}`] = matchResult;
    });
  });
  
  setH2hResults(results);
}, [scores, scoringConfig, course, turboValues, h2hStrokeAllocation, players]);
```

### Display Results

Add summary section showing match results:

```jsx
{/* H2H Match Results */}
<div className="h2h-results-section">
  <h3>Head-to-Head Results</h3>
  {Object.entries(h2hResults).map(([pair, result]) => {
    const [aId, bId] = pair.split('-');
    const playerA = players.find(p => p.id === parseInt(aId));
    const playerB = players.find(p => p.id === parseInt(bId));
    
    return (
      <div key={pair} className="match-result">
        <span className={result.margin > 0 ? 'winner' : ''}>
          {playerA.username}: {result.totalPointsA}
        </span>
        <span className="vs">vs</span>
        <span className={result.margin < 0 ? 'winner' : ''}>
          {playerB.username}: {result.totalPointsB}
        </span>
        {result.margin !== 0 && (
          <span className="margin">
            {Math.abs(result.margin)} {result.margin > 0 ? 'up' : 'down'}
          </span>
        )}
      </div>
    );
  })}
</div>
```

## Styling Recommendations

```css
.h2h-results-section {
  margin-top: 2rem;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.match-result {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: white;
  border-radius: 6px;
}

.match-result .winner {
  font-weight: bold;
  color: #4caf50;
}

.match-result .vs {
  color: #999;
  font-size: 0.9rem;
}

.match-result .margin {
  font-size: 0.85rem;
  color: #666;
  font-style: italic;
}
```

## Testing the Calculation

### Unit Test Example
```javascript
describe('H2H Scoring', () => {
  const scoringConfig = {
    holeInOne: 10,
    eagle: 5,
    birdie: 2,
    parOrWorse: 1
  };
  
  it('awards birdie points with turbo multiplier', () => {
    const result = calculateH2HResult(
      { rawScore: 3, handicapStrokes: 0 }, // Birdie
      { rawScore: 5, handicapStrokes: 0 },
      { number: 1, par: 4 },
      scoringConfig,
      2 // Turbo 2x
    );
    
    expect(result.winner).toBe('A');
    expect(result.pointsA).toBe(4); // 2 points × 2x turbo
    expect(result.winCondition).toBe('birdie');
  });
  
  it('awards eagle points with normal multiplier', () => {
    const result = calculateH2HResult(
      { rawScore: 3, handicapStrokes: 0 }, // Eagle on Par 5
      { rawScore: 4, handicapStrokes: 0 },
      { number: 5, par: 5 },
      scoringConfig,
      1
    );
    
    expect(result.winner).toBe('A');
    expect(result.pointsA).toBe(5); // 5 points × 1x turbo
    expect(result.winCondition).toBe('eagle');
  });
});
```

## Next Implementation Steps

1. ✅ Create scoring config system (DONE)
2. ⬜ Add `calculateH2HResult` function
3. ⬜ Add `calculateMatchResult` function  
4. ⬜ Add `h2hResults` state in GamePlay
5. ⬜ Create useEffect to recalculate on score changes
6. ⬜ Add H2H Results display section
7. ⬜ Add per-hole result indicators
8. ⬜ Add match status (All Square, 1 Up, 2 Up, etc.)
9. ⬜ Add Front 9 / Back 9 / Total 18 summaries
10. ⬜ Test with various scenarios

## References

- Scoring Config: `docs/H2H_SCORING_CONFIG_TESTING.md`
- H2H Handicap: Existing `h2hStrokeAllocation` state
- Turbo Values: Existing `turboValues` state
- Course Data: Existing `course` state
