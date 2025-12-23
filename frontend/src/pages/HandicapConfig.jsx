import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './HandicapConfig.css';

function HandicapConfig() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [handicapMatrix, setHandicapMatrix] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPlayers();
    loadHandicapMatrix();
  }, [gameId]);

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
        setHandicapMatrix(response.data.handicapMatrix);
      }
    } catch (err) {
      console.error('Failed to load handicap matrix:', err);
    }
  };

  const updateHandicap = (fromPlayerId, toPlayerId, nine, value) => {
    const numValue = parseInt(value) || 0;
    setHandicapMatrix(prev => ({
      ...prev,
      [fromPlayerId]: {
        ...prev[fromPlayerId],
        [toPlayerId]: {
          ...prev[fromPlayerId][toPlayerId],
          [nine]: Math.max(0, Math.min(18, numValue)) // Limit 0-18 per 9 holes
        }
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await api.updateHandicapMatrix(gameId, handicapMatrix);
      navigate(`/game/${gameId}`);
    } catch (err) {
      console.error('Failed to save handicap matrix:', err);
      setError('ไม่สามารถบันทึกข้อมูลได้');
      setSaving(false);
    }
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
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="handicap-description">
        <p>กำหนดจำนวนแต้มที่ผู้เล่นแต่ละคนให้แก่ผู้เล่นอื่น (0-18 แต้มต่อ 9 หลุม)</p>
        <p className="note">* แต้มจะแยกคำนวณระหว่างหลุม 1-9 และ 10-18</p>
      </div>

      <div className="handicap-tables">
        {players.map(fromPlayer => (
          <div key={fromPlayer.id} className="player-handicap-section">
            <h3 className="player-name">{fromPlayer.username}</h3>
            <div className="handicap-grid">
              <table className="handicap-table">
                <thead>
                  <tr>
                    <th className="opponent-col">ให้แต้มต่อ</th>
                    <th className="nine-col">หลุม 1-9</th>
                    <th className="nine-col">หลุม 10-18</th>
                  </tr>
                </thead>
                <tbody>
                  {players
                    .filter(toPlayer => toPlayer.id !== fromPlayer.id)
                    .map(toPlayer => (
                      <tr key={toPlayer.id}>
                        <td className="opponent-name">{toPlayer.username}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="18"
                            value={handicapMatrix[fromPlayer.id]?.[toPlayer.id]?.front9 || 0}
                            onChange={(e) => updateHandicap(fromPlayer.id, toPlayer.id, 'front9', e.target.value)}
                            className="handicap-input"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="18"
                            value={handicapMatrix[fromPlayer.id]?.[toPlayer.id]?.back9 || 0}
                            onChange={(e) => updateHandicap(fromPlayer.id, toPlayer.id, 'back9', e.target.value)}
                            className="handicap-input"
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="handicap-actions">
        <button 
          className="btn-save" 
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
        <button 
          className="btn-cancel" 
          onClick={() => navigate(`/game/${gameId}`)}
          disabled={saving}
        >
          ยกเลิก
        </button>
      </div>
    </div>
  );
}

export default HandicapConfig;
