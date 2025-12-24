/**
 * H2H Golf Scoring Engine
 * Calculate Head-to-Head scoring using provided configuration
 */

export function calculateH2HScoring({
  h2hConfig,
  playerName,
  opponentName,
  holes,
  playerScores,
  opponentScores,
  handicaps,
  turboValues
}) {
  const results = [];
  let totalPoints = 0;
  let winCount = 0;
  let loseCount = 0;
  let tieCount = 0;
  let pendingCount = 0;

  holes.forEach(hole => {
    const holeNum = hole.hole;
    const par = hole.par;
    const turbo = turboValues[holeNum] || 1;
    const playerGross = playerScores[holeNum];
    const opponentGross = opponentScores[holeNum];
    const hc = handicaps[holeNum] || { type: 'None', value: 0 };

    // 1) Check pending
    if (!playerGross || !opponentGross || playerGross === '-' || opponentGross === '-') {
      results.push({
        hole: holeNum,
        par,
        turbo,
        playerGross: '-',
        opponentGross: '-',
        playerNet: '-',
        opponentNet: '-',
        handicap: hc.type,
        scoreType: null,
        basePoint: 0,
        holePoint: 0,
        result: 'PENDING',
        playerDelta: 0
      });
      pendingCount++;
      return;
    }

    // 2) Calculate Net Score
    let playerNet, opponentNet;
    if (hc.type === 'None') {
      playerNet = playerGross;
      opponentNet = opponentGross;
    } else if (hc.type.startsWith('Give')) {
      playerNet = playerGross;
      opponentNet = opponentGross - hc.value;
    } else if (hc.type.startsWith('Get')) {
      playerNet = playerGross - hc.value;
      opponentNet = opponentGross;
    }

    // 3) Determine Result
    let result;
    if (playerNet < opponentNet) {
      result = 'WIN';
    } else if (playerNet > opponentNet) {
      result = 'LOSE';
    } else {
      result = 'TIE';
    }

    // 4) Determine ScoreType - use correct gross score based on result
    let scoreType;
    let grossToEvaluate;
    
    if (result === 'WIN') {
      // Winner uses their own gross score
      grossToEvaluate = playerGross;
    } else if (result === 'LOSE') {
      // Loser uses opponent's gross score (winner's score)
      grossToEvaluate = opponentGross;
    } else {
      // TIE uses player's gross score
      grossToEvaluate = playerGross;
    }
    
    if (par === 3 && grossToEvaluate === 1) {
      scoreType = 'HIO';
    } else if (grossToEvaluate <= par - 2) {
      scoreType = 'Eagle';
    } else if (grossToEvaluate === par - 1) {
      scoreType = 'Birdie';
    } else {
      scoreType = 'Par';
    }

    // 5) BasePoint from config - map ScoreType to config keys
    let basePoint;
    if (scoreType === 'HIO') {
      basePoint = h2hConfig.holeInOne || h2hConfig.HIO || 10;
    } else if (scoreType === 'Eagle') {
      basePoint = h2hConfig.eagle || h2hConfig.Eagle || 5;
    } else if (scoreType === 'Birdie') {
      basePoint = h2hConfig.birdie || h2hConfig.Birdie || 2;
    } else {
      basePoint = h2hConfig.parOrWorse || h2hConfig.Par || 1;
    }

    // 6) HolePoint
    const holePoint = basePoint * turbo;

    // 7) PlayerDelta
    let playerDelta = 0;
    if (result === 'WIN') {
      playerDelta = holePoint;
      winCount++;
    } else if (result === 'LOSE') {
      playerDelta = -holePoint;
      loseCount++;
    } else if (result === 'TIE') {
      // TIE case: Check if opponent shot under par (penalty for player)
      if (opponentGross < par) {
        // Opponent shot under par - player loses points based on opponent's score
        let opponentScoreType;
        if (par === 3 && opponentGross === 1) {
          opponentScoreType = 'HIO';
        } else if (opponentGross <= par - 2) {
          opponentScoreType = 'Eagle';
        } else if (opponentGross === par - 1) {
          opponentScoreType = 'Birdie';
        }
        
        let penaltyBasePoint;
        if (opponentScoreType === 'HIO') {
          penaltyBasePoint = h2hConfig.holeInOne || h2hConfig.HIO || 10;
        } else if (opponentScoreType === 'Eagle') {
          penaltyBasePoint = h2hConfig.eagle || h2hConfig.Eagle || 5;
        } else if (opponentScoreType === 'Birdie') {
          penaltyBasePoint = h2hConfig.birdie || h2hConfig.Birdie || 2;
        }
        
        const penaltyHolePoint = penaltyBasePoint * turbo;
        const parPoints = h2hConfig.parOrWorse || h2hConfig.Par || 1;
        const parHolePoint = parPoints * turbo;
        playerDelta = -(penaltyHolePoint - parHolePoint); // Negative penalty minus par
      } else if (hc.type !== 'None' && playerGross < par) {
        // Normal TIE bonus: Player shot under par with handicap
        const parPoints = h2hConfig.parOrWorse || h2hConfig.Par || 1;
        playerDelta = (basePoint - parPoints) * turbo;
      }
      tieCount++;
    }

    totalPoints += playerDelta;

    results.push({
      hole: holeNum,
      par,
      turbo,
      playerGross,
      opponentGross,
      playerNet,
      opponentNet,
      handicap: hc.type,
      scoreType,
      basePoint,
      holePoint,
      result,
      playerDelta
    });
  });

  return {
    playerName,
    opponentName,
    holes: results,
    summary: {
      totalPoints,
      winCount,
      loseCount,
      tieCount,
      pendingCount
    }
  };
}

export function formatH2HDebugOutput(h2hResult) {
  console.log(`\n=== ${h2hResult.playerName} vs ${h2hResult.opponentName} ===`);
  console.log('Hole | Par | Turbo | PlayerGross | OpponentGross | PlayerNet | OpponentNet | HC | ScoreType | BasePoint | HolePoint | Result | PlayerDelta');
  console.log('-----|-----|-------|-------------|---------------|-----------|-------------|-------|-----------|-----------|-----------|--------|------------');
  
  h2hResult.holes.forEach(h => {
    const line = `H${h.hole.toString().padStart(2)} | ${h.par} | x${h.turbo} | ${String(h.playerGross).padStart(2)} | ${String(h.opponentGross).padStart(2)} | ${String(h.playerNet).padStart(2)} | ${String(h.opponentNet).padStart(2)} | ${h.handicap.padEnd(6)} | ${(h.scoreType || '-').padEnd(6)} | ${h.basePoint} | ${h.holePoint} | ${h.result.padEnd(7)} | ${h.playerDelta >= 0 ? '+' : ''}${h.playerDelta}`;
    console.log(line);
  });

  console.log('\n--- SUMMARY ---');
  console.log(`Total Points: ${h2hResult.summary.totalPoints >= 0 ? '+' : ''}${h2hResult.summary.totalPoints}`);
  console.log(`WIN: ${h2hResult.summary.winCount} | LOSE: ${h2hResult.summary.loseCount} | TIE: ${h2hResult.summary.tieCount} | PENDING: ${h2hResult.summary.pendingCount}`);
}
