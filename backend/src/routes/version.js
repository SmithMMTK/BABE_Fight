import express from 'express';

const router = express.Router();

// Get version/build information
router.get('/', (req, res) => {
  const versionInfo = {
    version: process.env.APP_VERSION || 'dev',
    buildTime: process.env.BUILD_TIME || new Date().toISOString(),
    gitCommit: process.env.GIT_COMMIT || 'unknown',
    environment: process.env.NODE_ENV || 'development'
  };
  
  res.json(versionInfo);
});

export default router;
