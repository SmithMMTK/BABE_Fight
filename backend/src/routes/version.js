import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load version config
let versionConfig = {
  version: 'BETA 2.0',
  gitCommit: 'Missing',
  buildTime: new Date().toISOString(),
  environment: 'production'
};

try {
  // Try multiple paths for different environments
  const possiblePaths = [
    path.join(__dirname, '../../../version.config.json'),  // Local dev
    '/app/version.config.json',                             // Docker absolute path
    path.join(process.cwd(), 'version.config.json'),        // Docker/Production relative
  ];
  
  let foundPath = null;
  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      versionConfig = JSON.parse(configData);
      foundPath = configPath;
      console.log('✅ Version config loaded from:', configPath);
      break;
    } else {
      console.log('⚠️  Version config not found at:', configPath);
    }
  }
  
  if (!foundPath) {
    console.error('❌ Version config not found in any path');
  }
} catch (err) {
  console.error('Failed to load version config:', err);
}

// Get version/build information
router.get('/', (req, res) => {
  const versionInfo = {
    version: process.env.APP_VERSION || versionConfig.version,
    buildTime: process.env.BUILD_TIME || versionConfig.buildTime,
    gitCommit: process.env.GIT_COMMIT || versionConfig.gitCommit,
    environment: process.env.NODE_ENV || versionConfig.environment
  };
  
  res.json(versionInfo);
});

export default router;
