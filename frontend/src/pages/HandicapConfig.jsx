import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './HandicapConfig.css';

function HandicapConfig() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [handicapMatrix, setHandicapMatrix] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    const initializeData = async () => {
      await loadPlayers();
      await loadHandicapMatrix();
      isInitializedRef.current = true;
    };
    initializeData();
  }, [gameId]);

  // Auto-save when handicap matrix changes
  useEffect(() => {
    if (!isInitializedRef.current) return;
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout to save after 1 second of no changes
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        await api.updateHandicapMatrix(gameId, handicapMatrix);
        setSaving(false);
        setError('');
      } catch (err) {
        console.error('Failed to auto-save handicap matrix:', err);
        setError('ไม่สามารถบันทึกข้อมูลอัตโนมัติได้');
        setSaving(false);
      }
    }, 1000);

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [handicapMatrix, gameId]);

  const loadPlayers = async () => {
    try {
      const response = await api.getGame(gameId);
      setPlayers(response.data.players);
      
      // Initialize handicap matrix with zeros
      const matrix = {};
      response.data.players.forEach(fromPlayer => {
        matrix[fromPlayer.id] = {};
        response.data.players.forEach(toPlayer => {
          if (fromPlayer.id !== toPlayer.id) {
            matrix[fromPlayer.id][toPlayer.id] = { front9: 0, back9: 0 };
          }
        });
      });
      setHandicapMatrix(matrix);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load players:', err);
      setError('ไม่สามารถโหลดข้อมูลผู้เล่นได้');
      setLoading(false);
    }
  };

  const loadHandicapMatrix = async () => {
    try {
      const response = await api.getHandicapMatrix(gameId);
      if (response.data.handicapMatrix) {
        setHandicapMatrix(prevMatrix => {
          // Merge loaded data with existing structure
          const newMatrix = { ...prevMatrix };
          Object.keys(response.data.handicapMatrix).forEach(fromId => {
            if (!newMatrix[fromId]) newMatrix[fromId] = {};
            Object.keys(response.data.handicapMatrix[fromId]).forEach(toId => {
              newMatrix[fromId][toId] = response.data.handicapMatrix[fromId][toId];
            });
          });
          return newMatrix;
        });
      }
    } catch (err) {
      console.error('Failed to load handicap matrix:', err);
    }
  };

  const getDisplayText = (value) => {
    if (value === 0) return 'เสมอ';
    if (value > 0) return `ได้ ${value}`;
    return `ให้ ${Math.abs(value)}`;
  };

  const updateHandicap = (fromPlayerId, toPlayerId, nine, value) => {
    const numValue = parseInt(value) || 0;
    // Accept -10 to +10
    const clampedValue = Math.max(-10, Math.min(10, numValue));
    
    setHandicapMatrix(prev => {
      const newMatrix = {
        ...prev,
        [fromPlayerId]: {
          ...prev[fromPlayerId],
          [toPlayerId]: {
            ...prev[fromPlayerId][toPlayerId],
            [nine]: clampedValue
          }
        }
      };
      
      // Update reciprocal cell with opposite value
      if (newMatrix[toPlayerId] && newMatrix[toPlayerId][fromPlayerId]) {
        newMatrix[toPlayerId] = {
          ...newMatrix[toPlayerId],
          [fromPlayerId]: {
            ...newMatrix[toPlayerId][fromPlayerId],
            [nine]: -clampedValue
          }
        };
      }
      
      return newMatrix;
    });
  };

  if (loading) {
    return (
      <div className="container handicap-config">
        <div className="loading">กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="container handicap-config">
      <div className="handicap-header">
        <button className="btn-back" onClick={() => navigate(`/game/${gameId}`)}>
          ← กลับ
        </button>
        <h1>ตั้งค่าแต้มต่อ H2H</h1>
        {saving && <span className="saving-indicator">กำลังบันทึก...</span>}
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="handicap-description">
        <p><strong>วิธีใช้:</strong> เลือกแต้มต่อระหว่างแถวและคอลัมน์ (-10 ถึง +10)</p>
        <p className="note">* ค่าลบ = ให้แต้มต่อ | ค่าบวก = รับแต้มต่อ</p>
        <p className="note">* แต้มจะแยกคำนวณระหว่างหลุม 1-9 และ 10-18</p>
        <p className="note">* คู่ต่อฝั่งตรงข้ามจะอัพเดทอัตโนมัติ</p>
        <p className="note">* ระบบบันทึกอัตโนมัติเมื่อมีการเปลี่ยนแปลง</p>
      </div>

      {/* Front 9 Matrix */}
      <div className="matrix-section">
        <h2 className="matrix-title">หลุม 1-9 (Front 9)</h2>
        <div className="matrix-wrapper">
          <table className="handicap-matrix">
            <thead>
              <tr>
                <th className="corner-cell"></th>
                {players.map(player => (
                  <th key={player.id} className="player-header">{player.username}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map(rowPlayer => (
                <tr key={rowPlayer.id}>
                  <th className="player-row-header">{rowPlayer.username}</th>
                  {players.map(colPlayer => {
                    const isSamePlayer = rowPlayer.id === colPlayer.id;
                    const value = handicapMatrix[rowPlayer.id]?.[colPlayer.id]?.front9 || 0;
                    return (
                      <td key={colPlayer.id} className="matrix-cell">
                        {isSamePlayer ? (
                          <div className="same-player">—</div>
                        ) : (
                          <select
                            value={value}
                            onChange={(e) => updateHandicap(rowPlayer.id, colPlayer.id, 'front9', e.target.value)}
                            className={`matrix-select ${value > 0 ? 'positive' : value < 0 ? 'negative' : ''}`}
                            aria-label={`แฮนดิแคป ${rowPlayer.name} vs ${colPlayer.name} Front 9`}
                          >
                            {[-10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                              <option key={num} value={num}>{getDisplayText(num)}</option>
                            ))}
                          </select>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Back 9 Matrix */}
      <div className="matrix-section">
        <h2 className="matrix-title">หลุม 10-18 (Back 9)</h2>
        <div className="matrix-wrapper">
          <table className="handicap-matrix">
            <thead>
              <tr>
                <th className="corner-cell"></th>
                {players.map(player => (
                  <th key={player.id} className="player-header">{player.username}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map(rowPlayer => (
                <tr key={rowPlayer.id}>
                  <th className="player-row-header">{rowPlayer.username}</th>
                  {players.map(colPlayer => {
                    const isSamePlayer = rowPlayer.id === colPlayer.id;
                    const value = handicapMatrix[rowPlayer.id]?.[colPlayer.id]?.back9 || 0;
                    return (
                      <td key={colPlayer.id} className="matrix-cell">
                        {isSamePlayer ? (
                          <div className="same-player">—</div>
                        ) : (
                          <select
                            value={value}
                            onChange={(e) => updateHandicap(rowPlayer.id, colPlayer.id, 'back9', e.target.value)}
                            className={`matrix-select ${value > 0 ? 'positive' : value < 0 ? 'negative' : ''}`}
                            aria-label={`แฮนดิแคป ${rowPlayer.name} vs ${colPlayer.name} Back 9`}
                          >
                            {[-10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                              <option key={num} value={num}>{getDisplayText(num)}</option>
                            ))}
                          </select>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default HandicapConfig;
