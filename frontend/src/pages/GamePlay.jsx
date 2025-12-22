import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './GamePlay.css';

const GamePlay = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  
  const [game, setGame] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [scores, setScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentHole, setCurrentHole] = useState(1);
  const [showPins, setShowPins] = useState(false);
  const [showManagement, setShowManagement] = useState(false);
  const [hostPin, setHostPin] = useState('');
  const [guestPin, setGuestPin] = useState('');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    loadGameData();
    
    // Check if PINs were passed from creation
    if (location.state?.showPins) {
      setHostPin(location.state.hostPin);
      setGuestPin(location.state.guestPin);
      setShowPins(true);
    }
    if (location.state?.joinedRole) {
      setUserRole(location.state.joinedRole);
    }
  }, [gameId]);

  useEffect(() => {
    if (!socket || !connected) return;

    socket.emit('joinGame', parseInt(gameId));

    socket.on('scoreUpdated', (updatedScore) => {
      setScores(prev => ({
        ...prev,
        [`${updatedScore.user_id}_${updatedScore.hole_number}`]: updatedScore
      }));
    });

    socket.on('playerJoined', (player) => {
      setParticipants(prev => [...prev, player]);
    });

    socket.on('playerLeft', (player) => {
      setParticipants(prev => prev.filter(p => p.userId !== player.userId));
    });

    return () => {
      socket.off('scoreUpdated');
      socket.off('playerJoined');
      socket.off('playerLeft');
    };
  }, [socket, connected, gameId]);

  const loadGameData = async () => {
    try {
      const response = await api.get(`/games/${gameId}`);
      const { game, participants, scores: gameScores } = response.data;
      
      setGame(game);
      setParticipants(participants);
      
      // Find user's role
      const userParticipant = participants.find(p => p.id === user?.id);
      if (userParticipant) {
        setUserRole(userParticipant.role);
      }
      
      // Store PINs if user is HOST
      if (userParticipant?.role === 'HOST') {
        setHostPin(game.host_pin);
        setGuestPin(game.guest_pin);
      }
      
      const scoresMap = {};
      gameScores.forEach(score => {
        scoresMap[`${score.user_id}_${score.hole_number}`] = score;
      });
      setScores(scoresMap);
      
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load game');
      setLoading(false);
    }
  };

  const handleRemovePlayer = async (playerId) => {
    if (!window.confirm('Are you sure you want to remove this player?')) {
      return;
    }

    try {
      await api.delete(`/games/${gameId}/participants/${playerId}`);
      loadGameData(); // Reload to update participant list
    } catch (err) {
      if (err.response?.data?.requireConfirmation) {
        if (window.confirm(err.response.data.error + '\n\nClick OK to confirm.')) {
          // User confirmed self-removal
          await api.delete(`/games/${gameId}/participants/${playerId}?confirm=true`);
          navigate('/');
        }
      } else {
        setError('Failed to remove player');
      }
    }
  };

  const handleChangeRole = async (playerId, newRole) => {
    try {
      await api.put(`/games/${gameId}/participants/${playerId}/role`, { role: newRole });
      loadGameData(); // Reload to update roles
    } catch (err) {
      setError('Failed to change role');
    }
  };

  const canManage = userRole === 'HOST' || userRole === 'CO-HOST';

  const handleScoreUpdate = async (holeNumber, strokes) => {
    try {
      await api.post('/scores', {
        gameId: parseInt(gameId),
        holeNumber,
        strokes
      });
      
      // Socket will handle the update broadcast
    } catch (err) {
      setError('Failed to update score');
    }
  };

  const getPlayerScore = (userId, holeNumber) => {
    return scores[`${userId}_${holeNumber}`]?.strokes || 0;
  };

  const getPlayerTotal = (userId) => {
    let total = 0;
    for (let i = 1; i <= 18; i++) {
      total += getPlayerScore(userId, i);
    }
    return total;
  };

  if (loading) {
    return (
      <div className="page">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="error">{error}</div>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  return (
    <div className="game-play-page">
      <div className="game-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Exit
        </button>
        <div className="game-info">
          <h2>Game Code: {game?.game_code}</h2>
          <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            {connected ? 'Live' : 'Offline'}
          </div>
        </div>
        {canManage && (
          <div className="host-controls">
            <button 
              className="secondary small-button"
              onClick={() => setShowPins(!showPins)}
            >
              {showPins ? 'Hide PINs' : 'Show PINs'}
            </button>
            <button 
              className="secondary small-button"
              onClick={() => setShowManagement(!showManagement)}
            >
              {showManagement ? 'Hide' : 'Manage'} Players
            </button>
          </div>
        )}
      </div>

      {showPins && (hostPin || guestPin) && (
        <div className="pins-display">
          <h3>Share these PINs with players:</h3>
          <div className="pin-boxes">
            <div className="pin-box host">
              <div className="pin-label">HOST PIN (Co-Host)</div>
              <div className="pin-value">{hostPin}</div>
            </div>
            <div className="pin-box guest">
              <div className="pin-label">GUEST PIN (Player)</div>
              <div className="pin-value">{guestPin}</div>
            </div>
          </div>
        </div>
      )}

      {showManagement && canManage && (
        <div className="management-panel">
          <h3>Manage Players</h3>
          <div className="player-list">
            {participants.map(participant => (
              <div key={participant.id} className="player-row">
                <div className="player-info">
                  <span className="player-name">{participant.username}</span>
                  <span className={`player-role ${participant.role.toLowerCase()}`}>
                    {participant.role}
                  </span>
                </div>
                {participant.id !== user?.id && (
                  <div className="player-actions">
                    <select
                      value={participant.role}
                      onChange={(e) => handleChangeRole(participant.id, e.target.value)}
                      className="role-select"
                    >
                      <option value="HOST">HOST</option>
                      <option value="CO-HOST">CO-HOST</option>
                      <option value="GUEST">GUEST</option>
                    </select>
                    <button
                      onClick={() => handleRemovePlayer(participant.id)}
                      className="remove-button"
                    >
                      Remove
                    </button>
                  </div>
                )}
                {participant.id === user?.id && (
                  <div className="player-actions">
                    <span className="you-label">(You)</span>
                    <button
                      onClick={() => handleRemovePlayer(participant.id)}
                      className="remove-button danger"
                    >
                      Leave Game
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="hole-selector">
        <button 
          onClick={() => setCurrentHole(Math.max(1, currentHole - 1))}
          disabled={currentHole === 1}
        >
          ← Prev
        </button>
        <h3>Hole {currentHole}</h3>
        <button 
          onClick={() => setCurrentHole(Math.min(18, currentHole + 1))}
          disabled={currentHole === 18}
        >
          Next →
        </button>
      </div>

      <div className="scoreboard">
        {participants.map(participant => (
          <div key={participant.id} className="player-card">
            <div className="player-header">
              <h4>
                {participant.username}
                {participant.role === 'HOST' && ' 👑'}
                {participant.id === user?.id && ' (You)'}
              </h4>
              <div className="player-total">
                Total: {getPlayerTotal(participant.id)}
              </div>
            </div>
            
            <div className="score-input">
              <label>Hole {currentHole} Score:</label>
              <div className="score-controls">
                {participant.id === user?.id ? (
                  <>
                    <button
                      onClick={() => {
                        const current = getPlayerScore(participant.id, currentHole);
                        if (current > 0) handleScoreUpdate(currentHole, current - 1);
                      }}
                    >
                      -
                    </button>
                    <span className="score-display">
                      {getPlayerScore(participant.id, currentHole)}
                    </span>
                    <button
                      onClick={() => {
                        const current = getPlayerScore(participant.id, currentHole);
                        handleScoreUpdate(currentHole, current + 1);
                      }}
                    >
                      +
                    </button>
                  </>
                ) : (
                  <span className="score-display readonly">
                    {getPlayerScore(participant.id, currentHole)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GamePlay;