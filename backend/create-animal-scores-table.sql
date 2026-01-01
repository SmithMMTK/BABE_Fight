-- Create Animal Scores Table
-- This table stores animal penalty points for each player on each hole

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'animal_scores')
BEGIN
    CREATE TABLE animal_scores (
        id INT IDENTITY(1,1) PRIMARY KEY,
        game_id INT NOT NULL,
        player_id INT NOT NULL,
        hole_number INT NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
        animal_type NVARCHAR(20) NOT NULL CHECK (animal_type IN ('monkey', 'giraffe', 'snake', 'camel', 'frog', 'monitor_lizard')),
        count INT NOT NULL DEFAULT 0 CHECK (count >= 0),
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        
        -- Foreign keys
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        
        -- Unique constraint: one record per game, player, hole, and animal type
        CONSTRAINT UQ_animal_scores UNIQUE (game_id, player_id, hole_number, animal_type)
    );
    
    PRINT 'Table animal_scores created successfully';
END
ELSE
BEGIN
    PRINT 'Table animal_scores already exists';
END;
GO

-- Create index for faster queries
CREATE INDEX IX_animal_scores_game_player ON animal_scores(game_id, player_id);
CREATE INDEX IX_animal_scores_hole ON animal_scores(game_id, hole_number);
GO

PRINT 'Animal scores table setup complete';
