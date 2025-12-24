-- Create game_scoring_config table to store H2H scoring configuration per game
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[game_scoring_config]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[game_scoring_config] (
        [game_id] NVARCHAR(50) NOT NULL PRIMARY KEY,
        [hole_in_one] INT NOT NULL DEFAULT 10,
        [eagle] INT NOT NULL DEFAULT 5,
        [birdie] INT NOT NULL DEFAULT 2,
        [par_or_worse] INT NOT NULL DEFAULT 1,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT [FK_game_scoring_config_games] FOREIGN KEY ([game_id]) 
            REFERENCES [dbo].[games] ([game_id]) 
            ON DELETE CASCADE
    );
    
    PRINT 'Table game_scoring_config created successfully';
END
ELSE
BEGIN
    PRINT 'Table game_scoring_config already exists';
END
GO

-- Create index on game_id for faster lookups
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_game_scoring_config_game_id' AND object_id = OBJECT_ID('game_scoring_config'))
BEGIN
    CREATE INDEX IX_game_scoring_config_game_id ON [dbo].[game_scoring_config] ([game_id]);
    PRINT 'Index IX_game_scoring_config_game_id created successfully';
END
GO
