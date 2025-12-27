-- Add albatross column to game_scoring_config table
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[game_scoring_config]') 
    AND name = 'albatross'
)
BEGIN
    ALTER TABLE [dbo].[game_scoring_config]
    ADD [albatross] INT NOT NULL DEFAULT 10;
    
    PRINT 'Column albatross added successfully to game_scoring_config table';
END
ELSE
BEGIN
    PRINT 'Column albatross already exists in game_scoring_config table';
END
GO
