/**
 * Handicap Stroke Allocation Algorithm - Frontend
 * Implements H2H (Head-to-Head) stroke allocation based on player handicaps
 */

/**
 * Calculate handicap matrix for all players in a game
 * @param {Array} players - Array of player objects with id and handicap
 * @returns {Object} Handicap matrix { fromPlayerId: { toPlayerId: strokes } }
 */
export function calculateHandicapMatrix(players) {
  const matrix = {};

  for (const fromPlayer of players) {
    matrix[fromPlayer.id] = {};
    
    for (const toPlayer of players) {
      if (fromPlayer.id === toPlayer.id) {
        matrix[fromPlayer.id][toPlayer.id] = 0;
      } else {
        // Calculate stroke difference (positive means fromPlayer gives strokes to toPlayer)
        const strokeDiff = fromPlayer.handicap - toPlayer.handicap;
        matrix[fromPlayer.id][toPlayer.id] = Math.max(0, strokeDiff);
      }
    }
  }

  return matrix;
}

/**
 * Allocate strokes for a specific player pair on a 9-hole segment
 * @param {number} strokes - Number of strokes to allocate
 * @param {Array} holes - Array of hole objects { hole, par, hc, turbo }
 * @param {Object} turboValues - Current turbo multipliers { holeNumber: multiplier }
 * @returns {Object} Hole allocation { holeNumber: strokeCount }
 */
export function allocateStrokesFor9Holes(strokes, holes, turboValues = {}) {
  if (strokes === 0) return {};

  // Filter out turbo holes (where turbo > 1)
  const normalHoles = holes.filter(h => {
    const turboMultiplier = turboValues[h.hole] || 1;
    return turboMultiplier === 1;
  });

  if (normalHoles.length === 0) return {};

  // Sort holes: Par 4/5 by HC ascending, then Par 3 by HC ascending
  const par45Holes = normalHoles
    .filter(h => h.par >= 4)
    .sort((a, b) => a.hc - b.hc);
  
  const par3Holes = normalHoles
    .filter(h => h.par === 3)
    .sort((a, b) => a.hc - b.hc);

  const sortedHoles = [...par45Holes, ...par3Holes];

  const allocation = {};
  let remainingStrokes = strokes;

  // First pass: Allocate 1 stroke per hole
  for (let i = 0; i < sortedHoles.length && remainingStrokes > 0; i++) {
    const hole = sortedHoles[i];
    allocation[hole.hole] = 1;
    remainingStrokes--;
  }

  // Second pass: Add 2nd stroke to holes (max 2 strokes per hole)
  if (remainingStrokes > 0) {
    // Prioritize Par 4/5 first
    for (let i = 0; i < par45Holes.length && remainingStrokes > 0; i++) {
      const hole = par45Holes[i];
      if (allocation[hole.hole] === 1) {
        allocation[hole.hole] = 2;
        remainingStrokes--;
      }
    }

    // Then Par 3 if still remaining
    for (let i = 0; i < par3Holes.length && remainingStrokes > 0; i++) {
      const hole = par3Holes[i];
      if (allocation[hole.hole] === 1) {
        allocation[hole.hole] = 2;
        remainingStrokes--;
      }
    }
  }

  return allocation;
}

/**
 * Calculate complete stroke allocation for all player pairs
 * @param {Array} players - Array of player objects with id and handicap
 * @param {Array} courseHoles - Array of all 18 hole objects
 * @param {Object} turboValues - Current turbo multipliers { holeNumber: multiplier }
 * @returns {Object} Complete allocation { fromPlayerId: { toPlayerId: { front9: {}, back9: {} } } }
 */
export function calculateStrokeAllocation(players, courseHoles, turboValues = {}) {
  const handicapMatrix = calculateHandicapMatrix(players);
  const allocation = {};

  const front9 = courseHoles.filter(h => h.hole >= 1 && h.hole <= 9);
  const back9 = courseHoles.filter(h => h.hole >= 10 && h.hole <= 18);

  for (const fromPlayer of players) {
    allocation[fromPlayer.id] = {};

    for (const toPlayer of players) {
      const strokes = handicapMatrix[fromPlayer.id][toPlayer.id];

      allocation[fromPlayer.id][toPlayer.id] = {
        front9: allocateStrokesFor9Holes(strokes, front9, turboValues),
        back9: allocateStrokesFor9Holes(strokes, back9, turboValues)
      };
    }
  }

  return allocation;
}

/**
 * Get stroke display for a specific hole from player's perspective
 * @param {Object} strokeAllocation - Complete stroke allocation object
 * @param {string} viewPlayerId - Player viewing the scorecard
 * @param {string} targetPlayerId - Player column being viewed
 * @param {number} holeNumber - Hole number (1-18)
 * @returns {Object} { display: '', color: '', count: 0 } - Display info for the hole
 */
export function getStrokeDisplay(strokeAllocation, viewPlayerId, targetPlayerId, holeNumber) {
  if (viewPlayerId === targetPlayerId) {
    return { display: '', color: '', count: 0 };
  }

  const nine = holeNumber <= 9 ? 'front9' : 'back9';

  // Check strokes given by viewPlayer to targetPlayer
  const givingStrokes = strokeAllocation[viewPlayerId]?.[targetPlayerId]?.[nine]?.[holeNumber] || 0;

  // Check strokes received by viewPlayer from targetPlayer
  const receivingStrokes = strokeAllocation[targetPlayerId]?.[viewPlayerId]?.[nine]?.[holeNumber] || 0;

  if (givingStrokes > 0) {
    return {
      display: givingStrokes === 1 ? '*' : '**',
      color: 'red',
      count: -givingStrokes
    };
  }

  if (receivingStrokes > 0) {
    return {
      display: receivingStrokes === 1 ? '*' : '**',
      color: 'green',
      count: receivingStrokes
    };
  }

  return { display: '', color: '', count: 0 };
}
