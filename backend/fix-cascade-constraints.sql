-- Drop all CASCADE foreign key constraints and recreate with NO ACTION
-- This fixes the circular cascade path issue

-- Drop game_turbo FK
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('game_turbo'))
BEGIN
    DECLARE @fk_turbo NVARCHAR(255);
    SELECT @fk_turbo = name FROM sys.foreign_keys 
    WHERE parent_object_id = OBJECT_ID('game_turbo');
    EXEC('ALTER TABLE game_turbo DROP CONSTRAINT ' + @fk_turbo);
END
GO

-- Drop players FK
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('players'))
BEGIN
    DECLARE @fk_players NVARCHAR(255);
    SELECT @fk_players = name FROM sys.foreign_keys 
    WHERE parent_object_id = OBJECT_ID('players');
    EXEC('ALTER TABLE players DROP CONSTRAINT ' + @fk_players);
END
GO

-- Drop scores FK
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('scores'))
BEGIN
    DECLARE @fk_scores NVARCHAR(255);
    SELECT @fk_scores = name FROM sys.foreign_keys 
    WHERE parent_object_id = OBJECT_ID('scores');
    EXEC('ALTER TABLE scores DROP CONSTRAINT ' + @fk_scores);
END
GO

-- Recreate with NO ACTION
ALTER TABLE players ADD CONSTRAINT FK_players_games 
FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE NO ACTION;
GO

ALTER TABLE scores ADD CONSTRAINT FK_scores_players 
FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE NO ACTION;
GO

ALTER TABLE game_turbo ADD CONSTRAINT FK_game_turbo_games 
FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE NO ACTION;
GO

PRINT 'Foreign key constraints fixed successfully';
