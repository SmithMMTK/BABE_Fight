import express from 'express';
import db from '../db/database-mssql.js';

const router = express.Router();

/**
 * Animal Scores Routes
 * Handles CRUD operations for animal penalty scores
 */

// GET /api/games/:gameId/animals - Get all animal scores for a game
router.get('/:gameId/animals', async (req, res) => {
  const { gameId } = req.params;

  try {
    const animalScores = await db.all(
      'SELECT id, game_id, player_id, hole_number, animal_type, count, created_at, updated_at FROM animal_scores WHERE game_id = ? ORDER BY hole_number, player_id, animal_type',
      [gameId]
    );

    res.json({
      success: true,
      animalScores: animalScores
    });
  } catch (error) {
    console.error('Error fetching animal scores:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch animal scores',
      error: error.message
    });
  }
});

// POST /api/games/:gameId/animals - Update animal scores for a hole
router.post('/:gameId/animals', async (req, res) => {
  const { gameId } = req.params;
  const { holeNumber, animals } = req.body; // Changed to accept animals object with all players

  // Validate input
  if (!holeNumber || !animals) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: holeNumber, animals'
    });
  }

  if (holeNumber < 1 || holeNumber > 18) {
    return res.status(400).json({
      success: false,
      message: 'Hole number must be between 1 and 18'
    });
  }

  const validAnimalTypes = ['monkey', 'giraffe', 'snake', 'camel', 'frog', 'monitor_lizard'];
  const isSQL = process.env.DB_TYPE === 'mssql';
  
  try {
    // Update or insert animal scores for each player
    for (const [playerId, animalScores] of Object.entries(animals)) {
      for (const [animalType, count] of Object.entries(animalScores)) {
        if (!validAnimalTypes.includes(animalType)) {
          return res.status(400).json({
            success: false,
            message: `Invalid animal type: ${animalType}`
          });
        }

        if (count < 0) {
          return res.status(400).json({
            success: false,
            message: `Count cannot be negative for ${animalType}`
          });
        }

        if (count > 0) {
          // Upsert: Update if exists, insert if not
          if (isSQL) {
            // SQL Server: MERGE statement
            await db.run(`
              MERGE animal_scores AS target
              USING (SELECT ? AS game_id, ? AS player_id, ? AS hole_number, ? AS animal_type, ? AS count) AS source
              ON target.game_id = source.game_id 
                AND target.player_id = source.player_id 
                AND target.hole_number = source.hole_number 
                AND target.animal_type = source.animal_type
              WHEN MATCHED THEN
                UPDATE SET count = source.count, updated_at = GETDATE()
              WHEN NOT MATCHED THEN
                INSERT (game_id, player_id, hole_number, animal_type, count)
                VALUES (source.game_id, source.player_id, source.hole_number, source.animal_type, source.count);
            `, [parseInt(gameId), parseInt(playerId), parseInt(holeNumber), animalType, count]);
          }
        } else {
          // Delete if count is 0
          await db.run(
            'DELETE FROM animal_scores WHERE game_id = ? AND player_id = ? AND hole_number = ? AND animal_type = ?',
            [parseInt(gameId), parseInt(playerId), parseInt(holeNumber), animalType]
          );
        }
      }
    }

    // Fetch updated scores for this game
    const result = await db.all(
      'SELECT id, game_id, player_id, hole_number, animal_type, count FROM animal_scores WHERE game_id = ? ORDER BY hole_number, player_id, animal_type',
      [parseInt(gameId)]
    );

    res.json({
      success: true,
      message: 'Animal scores updated successfully',
      animalScores: result
    });

  } catch (error) {
    console.error('Error updating animal scores:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update animal scores',
      error: error.message
    });
  }
});

// DELETE /api/games/:gameId/animals/:holeNumber - Clear all animal scores for a hole
router.delete('/:gameId/animals/:holeNumber', async (req, res) => {
  const { gameId, holeNumber } = req.params;

  try {
    await db.run(
      'DELETE FROM animal_scores WHERE game_id = ? AND hole_number = ?',
      [parseInt(gameId), parseInt(holeNumber)]
    );

    res.json({
      success: true,
      message: `Animal scores cleared for hole ${holeNumber}`
    });

  } catch (error) {
    console.error('Error deleting animal scores:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete animal scores',
      error: error.message
    });
  }
});

export default router;
