/**
 * Animal Scoring Calculation
 * Calculates animal penalty scores with turbo multipliers
 */

const ANIMAL_TYPES = ['monkey', 'giraffe', 'snake', 'camel', 'frog', 'monitor_lizard'];

/**
 * Calculate animal scores for each player
 * @param {Array} animalScores - Raw animal scores from database
 * @param {Array} players - List of players
 * @param {Object} turboValues - Turbo multipliers by hole {1: 2, 9: 3, ...}
 * @returns {Object} - Calculated animal scores by player
 */
export function calculateAnimalScores(animalScores, players, turboValues) {
  const result = {};

  players.forEach(player => {
    result[player.id] = {
      playerId: player.id,
      playerName: player.username,
      front9: {}, // holes 1-9
      back9: {}, // holes 10-18
      totalFront9: 0,
      totalBack9: 0,
      grandTotal: 0,
      animalTotals: {} // Total per animal type
    };

    // Initialize animal totals
    ANIMAL_TYPES.forEach(type => {
      result[player.id].animalTotals[type] = 0;
    });
  });

  // Process each animal score
  animalScores.forEach(score => {
    const playerId = score.player_id;
    const holeNumber = score.hole_number;
    const animalType = score.animal_type;
    const count = score.count;
    const turbo = turboValues[holeNumber] || 1;

    if (!result[playerId]) return;

    // Calculate score with turbo multiplier
    const holeScore = count * turbo;

    // Store in appropriate nine
    const nine = holeNumber <= 9 ? 'front9' : 'back9';
    if (!result[playerId][nine][holeNumber]) {
      result[playerId][nine][holeNumber] = 0;
    }
    result[playerId][nine][holeNumber] += holeScore;

    // Add to totals
    if (nine === 'front9') {
      result[playerId].totalFront9 += holeScore;
    } else {
      result[playerId].totalBack9 += holeScore;
    }
    result[playerId].grandTotal += holeScore;

    // Add to animal type total
    result[playerId].animalTotals[animalType] += holeScore;
  });

  return result;
}

/**
 * Get animal summary for a hole (for display in modal)
 * @param {Array} animalScores - Raw animal scores
 * @param {Number} holeNumber - Hole number
 * @param {Array} players - List of players
 * @returns {Object} - Animal counts by player and type
 */
export function getAnimalSummaryForHole(animalScores, holeNumber, players) {
  const summary = {};
  
  players.forEach(player => {
    summary[player.id] = {};
    ANIMAL_TYPES.forEach(type => {
      const score = animalScores.find(
        s => s.player_id === player.id && 
             s.hole_number === holeNumber && 
             s.animal_type === type
      );
      summary[player.id][type] = score ? score.count : 0;
    });
  });

  return summary;
}

/**
 * Get total animal counts for display (not multiplied by turbo)
 * @param {Array} animalScores - Raw animal scores
 * @param {Array} players - List of players
 * @returns {Object} - Total counts per player per animal type
 */
export function getTotalAnimalCounts(animalScores, players) {
  const totals = {};

  players.forEach(player => {
    totals[player.id] = {};
    ANIMAL_TYPES.forEach(type => {
      totals[player.id][type] = 0;
    });
  });

  animalScores.forEach(score => {
    if (totals[score.player_id]) {
      totals[score.player_id][score.animal_type] += score.count;
    }
  });

  return totals;
}
