import { useEffect, useState } from 'react';
import { api } from '../services/api';
import './VersionInfo.css';

function VersionInfo() {
  const [version, setVersion] = useState(null);

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
      <div className="version-text">
        {version.version.startsWith('v') ? version.version : `v${version.version}`}
      </div>
    </div>
  );
}

export default VersionInfo;
