import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { api } from '../services/api';
import PlayersMenu from '../components/PlayersMenu';
import './GamePlay.css';

function GamePlay() {
  const { gameId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const socket = useSocket();

  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [scores, setScores] = useState({});
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPlayerId, setCurrentPlayerId] = useState(null);
  const [showPlayersMenu, setShowPlayersMenu] = useState(false);
  const [viewAsPlayerId, setViewAsPlayerId] = useState(null); // For HOST to view as another player

  const { isHost, hostPin, guestPin, username } = location.state || {};

  useEffect(() => {
    if (!location.state) {
      navigate('/');
      return;
    }

    loadGameData();
    loadCourse();

    if (socket) {
      socket.emit('join-game', gameId);

      socket.on('score-updated', handleScoreUpdate);
      socket.on('role-changed', handleRoleChanged);
      socket.on('username-changed', handleUsernameChanged);

      return () => {
        socket.off('score-updated', handleScoreUpdate);
        socket.off('role-changed', handleRoleChanged);
        socket.off('username-changed', handleUsernameChanged);
      };
    }
  }, [socket, gameId]);

  const loadGameData = async () => {
    try {
      const response = await api.getGame(gameId);
      setGame(response.data.game);
      setPlayers(response.data.players);

      // Find current player ID
      const currentPlayer = response.data.players.find(p => p.username === username);
      if (currentPlayer) {
        setCurrentPlayerId(currentPlayer.id);
      }

      const scoresResponse = await api.getGameScores(gameId);
      const scoresMap = {};
      scoresResponse.data.forEach(s => {
        if (!scoresMap[s.player_id]) scoresMap[s.player_id] = {};
        if (s.hole_number) scoresMap[s.player_id][s.hole_number] = s.score;
      });
      setScores(scoresMap);

      setLoading(false);
    } catch (err) {
      console.error('Failed to load game:', err);
      setError('ไม่สามารถโหลดข้อมูลเกมได้');
      setLoading(false);
    }
  };

  const loadCourse = async () => {
    try {
      const response = await api.getCourses();
      const gameResponse = await api.getGame(gameId);
      const courseData = response.data.find(c => c.id === gameResponse.data.game.course_id);
      setCourse(courseData);
    } catch (err) {
      console.error('Failed to load course:', err);
    }
  };

  const handleScoreUpdate = ({ playerId, holeNumber, score }) => {
    setScores(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [holeNumber]: score
      }
    }));
  };

  const handleRoleChanged = ({ playerId, newRole }) => {
    setPlayers(prev => prev.map(p => 
      p.id === playerId ? { ...p, role: newRole } : p
    ));
  };

  const handleUsernameChanged = ({ playerId, newUsername }) => {
    setPlayers(prev => prev.map(p => 
      p.id === playerId ? { ...p, username: newUsername } : p
    ));
  };

  // Player management functions
  const handleAddPlayer = async (username, role) => {
    try {
      const response = await api.addPlayer(gameId, { username, role });
      const newPlayer = response.data;
      setPlayers(prev => [...prev, newPlayer]);
      // ไม่ต้อง emit เพราะเราเพิ่มเองแล้ว - คนอื่นจะเห็นเมื่อ refresh
    } catch (err) {
      console.error('Failed to add player:', err);
      if (err.response?.status === 400) {
        setError('ชื่อผู้เล่นนี้มีอยู่แล้ว');
      } else {
        setError('ไม่สามารถเพิ่มผู้เล่นได้');
      }
    }
  };

  const handleRemovePlayer = async (playerId) => {
    try {
      await api.removePlayer(gameId, playerId);
      setPlayers(prev => prev.filter(p => p.id !== playerId));
      // ไม่ต้อง emit - คนอื่นจะเห็นเมื่อ refresh
    } catch (err) {
      console.error('Failed to remove player:', err);
      setError('ไม่สามารถลบผู้เล่นได้');
    }
  };

  const handleToggleRole = async (playerId, newRole) => {
    try {
      await api.togglePlayerRole(gameId, playerId, { role: newRole });
      setPlayers(prev => prev.map(p => 
        p.id === playerId ? { ...p, role: newRole } : p
      ));
      
      if (socket) {
        socket.emit('role-change', { gameId, playerId, newRole });
      }
    } catch (err) {
      console.error('Failed to toggle role:', err);
      setError('ไม่สามารถเปลี่ยน Role ได้');
    }
  };

  const handleUpdateUsername = async (playerId, newUsername) => {
    try {
      await api.updatePlayerUsername(gameId, playerId, { username: newUsername });
      setPlayers(prev => prev.map(p => 
        p.id === playerId ? { ...p, username: newUsername } : p
      ));
      
      if (socket) {
        socket.emit('username-change', { gameId, playerId, newUsername });
      }
    } catch (err) {
      console.error('Failed to update username:', err);
      setError('ไม่สามารถเปลี่ยนชื่อได้');
    }
  };

  const updateScore = async (playerId, holeNumber, score) => {
    try {
      await api.updateScore({ playerId, holeNumber, score });
      
      // Update local state
      setScores(prev => ({
        ...prev,
        [playerId]: {
          ...prev[playerId],
          [holeNumber]: score
        }
      }));

      // Broadcast to others
      if (socket) {
        socket.emit('score-update', { gameId, playerId, holeNumber, score });
      }
    } catch (err) {
      console.error('Failed to update score:', err);
      setError('ไม่สามารถบันทึกคะแนนได้');
    }
  };

  const calculateTotal = (playerId) => {
    if (!scores[playerId]) return 0;
    return Object.values(scores[playerId]).reduce((sum, score) => sum + (score || 0), 0);
  };

  const calculateFront9 = (playerId) => {
    if (!scores[playerId] || !course) return 0;
    return course.holes.slice(0, 9).reduce((sum, hole) => 
      sum + (scores[playerId][hole.hole] || 0), 0);
  };

  const calculateBack9 = (playerId) => {
    if (!scores[playerId] || !course) return 0;
    return course.holes.slice(9, 18).reduce((sum, hole) => 
      sum + (scores[playerId][hole.hole] || 0), 0);
  };

  const getScoreLabel = (score, par) => {
    const diff = score - par;
    if (score === 1) return 'Hole-in-One';
    if (diff === -3) return 'Albatross';
    if (diff === -2) return 'Eagle';
    if (diff === -1) return 'Birdie';
    if (diff === 0) return 'Par';
    if (diff === 1) return 'Bogey';
    if (diff === 2) return 'Double Bogey';
    if (diff === 3) return 'Triple Bogey';
    return `+${diff}`;
  };

  const getScoreOptions = (par) => {
    const options = [];
    const minScore = 1; // Hole-in-one is always possible
    const maxScore = par * 3;
    
    for (let score = minScore; score <= maxScore; score++) {
      options.push({
        value: score,
        label: `${score} - ${getScoreLabel(score, par)}`,
        display: score
      });
    }
    return options;
  };

  const getScoreClass = (score, par) => {
    if (!score) return '';
    if (score < par) return 'score-better';
    if (score > par) return 'score-worse';
    return 'score-par';
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">กำลังโหลด...</div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="container">
        <div className="error-message">ไม่พบข้อมูลสนามกอล์ฟ</div>
      </div>
    );
  }

  // Get current player info
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const displayName = currentPlayer?.username || username || 'Player';
  const isCurrentUserHost = currentPlayer ? (currentPlayer.role === 'host' || currentPlayer.is_host === 1 || currentPlayer.is_host === true) : isHost;

  // For view switching (HOST feature)
  const effectiveViewPlayerId = viewAsPlayerId || currentPlayerId;
  const viewAsPlayer = players.find(p => p.id === effectiveViewPlayerId);

  // Sort players: viewed player first, then others
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.id === effectiveViewPlayerId) return -1;
    if (b.id === effectiveViewPlayerId) return 1;
    return 0;
  });

  // Function to check if current user can edit a score
  const canEditScore = (playerId) => {
    if (isCurrentUserHost) return true; // HOST can edit all scores
    return playerId === currentPlayerId; // GUEST can only edit their own score
  };

  return (
    <div className="container gameplay-container">
      <div className="game-header">
        <div className="header-row">
          <div style={{flex: 1}}>
            <h1>{game?.course_name}</h1>
            <div style={{
              fontSize: '0.9rem',
              fontWeight: '700',
              color: '#666',
              marginTop: '0.25rem'
            }}>
              {displayName}
            </div>
            {isCurrentUserHost && (
              <select 
                value={effectiveViewPlayerId || ''} 
                onChange={(e) => setViewAsPlayerId(e.target.value ? parseInt(e.target.value) : null)}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.85rem',
                  borderRadius: '0.25rem',
                  border: '1px solid #ccc',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="">View as: {displayName} (Me)</option>
                {players.filter(p => p.id !== currentPlayerId).map(player => (
                  <option key={player.id} value={player.id}>
                    View as: {player.username}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button className="btn-players-menu" onClick={() => setShowPlayersMenu(!showPlayersMenu)}>
            <span className="players-icon">👥</span>
            <span className="players-count">({players.length})</span>
          </button>
        </div>

        {showPlayersMenu && (
          <PlayersMenu
            players={players}
            currentPlayerId={currentPlayerId}
            isHost={isHost}
            hostPin={hostPin}
            guestPin={guestPin}
            onAddPlayer={handleAddPlayer}
            onRemovePlayer={handleRemovePlayer}
            onToggleRole={handleToggleRole}
            onUpdateUsername={handleUpdateUsername}
            onClose={() => setShowPlayersMenu(false)}
          />
        )}

        {error && <div className="error-message">{error}</div>}
      </div>

      <div className="scorecard-container">
        <div className="scorecard-scroll">
          {/* Front 9 */}
          <table className="scorecard vertical">
            <thead>
              <tr>
                <th className="hole-col-vertical">Hole</th>
                <th className="par-col">Par</th>
                {sortedPlayers.map(player => (
                  <th key={player.id} className="player-col-vertical">
                    {player.username.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {course.holes.slice(0, 9).map((hole, idx) => (
                <tr key={idx} className={hole.point > 1 ? 'turbo-row' : ''}>
                  <td className="hole-col-vertical">
                    <div className="hole-number-vertical">
                      {hole.hole}
                      {hole.point > 1 && <span className="turbo-badge">x{hole.point}</span>}
                    </div>
                  </td>
                  <td className="par-col">
                    <div className="par-hc-group">
                      <div className="par-value">Par {hole.par}</div>
                      <div className="hc-value">HC {hole.hc}</div>
                    </div>
                  </td>
                  {sortedPlayers.map(player => (
                    <td key={player.id} className="score-cell-vertical">
                      {scores[player.id]?.[hole.hole] ? (
                        <div 
                          className={`score-display ${getScoreClass(scores[player.id][hole.hole], hole.par)}`}
                          onClick={() => canEditScore(player.id) && updateScore(player.id, hole.hole, null)}
                          style={{cursor: canEditScore(player.id) ? 'pointer' : 'default', opacity: canEditScore(player.id) ? 1 : 0.7}}
                        >
                          {scores[player.id][hole.hole]}
                        </div>
                      ) : canEditScore(player.id) ? (
                        <select
                          className="score-select"
                          value=""
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            if (value) {
                              updateScore(player.id, hole.hole, value);
                            }
                          }}
                        >
                          <option value="">-</option>
                          {getScoreOptions(hole.par).map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div style={{fontSize: '1rem', color: '#999'}}>-</div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {/* Front 9 Total */}
              <tr className="total-row">
                <td className="hole-col-vertical"><strong>1-9</strong></td>
                <td className="par-col"></td>
                {sortedPlayers.map(player => (
                  <td key={player.id} className="total-cell">
                    <strong>{calculateFront9(player.id)}</strong>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>

          {/* Back 9 */}
          <table className="scorecard vertical">
            <thead>
              <tr>
                <th className="hole-col-vertical">Hole</th>
                <th className="par-col">Par</th>
                {sortedPlayers.map(player => (
                  <th key={player.id} className="player-col-vertical">
                    {player.username.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {course.holes.slice(9, 18).map((hole, idx) => (
                <tr key={idx} className={hole.point > 1 ? 'turbo-row' : ''}>
                  <td className="hole-col-vertical">
                    <div className="hole-number-vertical">
                      {hole.hole}
                      {hole.point > 1 && <span className="turbo-badge">x{hole.point}</span>}
                    </div>
                  </td>
                  <td className="par-col">
                    <div className="par-hc-group">
                      <div className="par-value">Par {hole.par}</div>
                      <div className="hc-value">HC {hole.hc}</div>
                    </div>
                  </td>
                  {sortedPlayers.map(player => (
                    <td key={player.id} className="score-cell-vertical">
                      {scores[player.id]?.[hole.hole] ? (
                        <div 
                          className={`score-display ${getScoreClass(scores[player.id][hole.hole], hole.par)}`}
                          onClick={() => canEditScore(player.id) && updateScore(player.id, hole.hole, null)}
                          style={{cursor: canEditScore(player.id) ? 'pointer' : 'default', opacity: canEditScore(player.id) ? 1 : 0.7}}
                        >
                          {scores[player.id][hole.hole]}
                        </div>
                      ) : canEditScore(player.id) ? (
                        <select
                          className="score-select"
                          value=""
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            if (value) {
                              updateScore(player.id, hole.hole, value);
                            }
                          }}
                        >
                          <option value="">-</option>
                          {getScoreOptions(hole.par).map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div style={{fontSize: '1rem', color: '#999'}}>-</div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {/* Back 9 Total */}
              <tr className="total-row">
                <td className="hole-col-vertical"><strong>10-18</strong></td>
                <td className="par-col"></td>
                {sortedPlayers.map(player => (
                  <td key={player.id} className="total-cell">
                    <strong>{calculateBack9(player.id)}</strong>
                  </td>
                ))}
              </tr>
              {/* Grand Total */}
              <tr className="total-row final-row">
                <td className="hole-col-vertical"><strong>Total</strong></td>
                <td className="par-col"></td>
                {sortedPlayers.map(player => (
                  <td key={player.id} className="total-cell final">
                    <strong>{calculateTotal(player.id)}</strong>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default GamePlay;
