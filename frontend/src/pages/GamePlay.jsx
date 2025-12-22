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

  return (
    <div className="container gameplay-container">
      <div className="game-header">
        <div className="header-row">
          <h1>{game?.course_name}</h1>
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
          />
        </div>

        {error && <div className="error-message">{error}</div>}
      </div>

      <div className="scorecard-container">
        <div className="scorecard-scroll">
          <table className="scorecard">
            <thead>
              <tr>
                <th className="player-col sticky-col">ผู้เล่น</th>
                {course.holes.map((hole, idx) => (
                  <th key={idx} className="hole-col">
                    <div className="hole-header">
                      <div className="hole-number">{hole.hole}</div>
                      <div className="hole-par">Par {hole.par}</div>
                    </div>
                  </th>
                ))}
                <th className="total-col">รวม</th>
              </tr>
            </thead>
            <tbody>
              {players.map(player => (
                <tr key={player.id}>
                  <td className="player-col sticky-col">
                    <div className="player-info">
                      <div className="player-name">{player.username}</div>
                      {player.role === 'host' && <span className="host-badge">HOST</span>}
                    </div>
                  </td>
                  {course.holes.map((hole, idx) => (
                    <td key={idx} className="score-cell">
                      <input
                        type="number"
                        className="score-input"
                        value={scores[player.id]?.[hole.hole] || ''}
                        onChange={(e) => {
                          const value = e.target.value ? parseInt(e.target.value) : null;
                          if (value === null || (value >= 1 && value <= 15)) {
                            updateScore(player.id, hole.hole, value);
                          }
                        }}
                        min="1"
                        max="15"
                        placeholder="-"
                      />
                    </td>
                  ))}
                  <td className="total-col">
                    <div className="total-score">{calculateTotal(player.id)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="game-actions">
        <button onClick={() => navigate('/')} className="btn btn-secondary">
          ← กลับหน้าหลัก
        </button>
      </div>
    </div>
  );
}

export default GamePlay;
