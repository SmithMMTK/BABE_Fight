import { useEffect, useState } from 'react';
import { api } from '../services/api';
import './VersionInfo.css';

function VersionInfo() {
  const [version, setVersion] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await api.getVersion();
        setVersion(response.data);
      } catch (err) {
        console.error('Failed to fetch version:', err);
      }
    };
    fetchVersion();
  }, []);

  if (!version) return null;

  return (
    <div className="version-info">
      <div 
        className="version-badge" 
        onClick={() => setShowDetails(!showDetails)}
        title="Click for details"
      >
        v{version.version}
      </div>
      
      {showDetails && (
        <div className="version-details">
          <div><strong>Version:</strong> {version.version}</div>
          <div><strong>Build Time:</strong> {new Date(version.buildTime).toLocaleString('th-TH')}</div>
          <div><strong>Commit:</strong> {version.gitCommit.substring(0, 7)}</div>
          <div><strong>Environment:</strong> {version.environment}</div>
        </div>
      )}
    </div>
  );
}

export default VersionInfo;
