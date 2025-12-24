import { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { api } from '../services/api';
import PlayersMenu from '../components/PlayersMenu';
import ScoringConfigModal from '../components/ScoringConfigModal';
import { calculateStrokeAllocation, getStrokeDisplay, allocateStrokesFor9Holes } from '../utils/strokeAllocation';
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
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionInfo, setVersionInfo] = useState(null);
  const [viewAsPlayerId, setViewAsPlayerId] = useState(null); // For HOST to view as another player
  const [turboValues, setTurboValues] = useState({}); // Track turbo multipliers for each hole
  const [showTurboDropdown, setShowTurboDropdown] = useState(null); // holeNumber
  const [lastTapTime, setLastTapTime] = useState({});
  const [lastTapHole, setLastTapHole] = useState(null);
  const [h2hStrokeAllocation, setH2hStrokeAllocation] = useState(null); // H2H handicap matrix from server
  const [rawH2hMatrix, setRawH2hMatrix] = useState(null); // Raw H2H matrix from database
  const [h2hReloadTrigger, setH2hReloadTrigger] = useState(0); // Trigger to force H2H reload
  const [scoringConfig, setScoringConfig] = useState(null); // H2H scoring configuration (hole-in-one, eagle, birdie, par or worse)
  const [showScoringConfigModal, setShowScoringConfigModal] = useState(false);

  // Get session from localStorage or location.state
  const getSession = () => {
    const savedSession = localStorage.getItem(`game_session_${gameId}`);
    if (savedSession) {
      return JSON.parse(savedSession);
    }
    return location.state;
  };

  const sessionData = getSession();
  const { isHost, hostPin, guestPin, username } = sessionData || {};

  // Calculate stroke allocation for H2H handicap
  // Use H2H matrix from server if available, otherwise calculate from player handicaps
  const strokeAllocation = useMemo(() => {
    if (!course || !players || players.length === 0) return {};
    
    // If we have H2H data from server, use it directly
    if (h2hStrokeAllocation) {
      console.log('Using H2H stroke allocation from server:', h2hStrokeAllocation);
      return h2hStrokeAllocation;
    }
    
    // Fallback: Calculate from player handicaps
    console.log('Calculating stroke allocation from player handicaps');
    const allocation = calculateStrokeAllocation(players, course.holes, turboValues);
    console.log('Calculated stroke allocation:', allocation);
    return allocation;
  }, [players, course, turboValues, h2hStrokeAllocation]);

  useEffect(() => {
    // Fetch version info
    const fetchVersion = async () => {
      try {
        const response = await api.getVersion();
        setVersionInfo(response.data);
      } catch (err) {
        console.error('Failed to fetch version:', err);
      }
    };
    fetchVersion();
  }, []);

  // Load H2H matrix when course and turboValues are ready, or when trigger changes
  useEffect(() => {
    if (course && turboValues && Object.keys(turboValues).length > 0) {
      console.log('Course and turbo values ready, loading H2H matrix');
      loadH2HMatrix();
    } else {
      console.log('Waiting for dependencies:', { 
        hasCourse: !!course, 
        turboValuesLength: Object.keys(turboValues).length 
      });
    }
  }, [course, turboValues, gameId, h2hReloadTrigger]); // Add h2hReloadTrigger

  useEffect(() => {
    // Save session to localStorage when component mounts
    if (location.state && gameId) {
      localStorage.setItem(`game_session_${gameId}`, JSON.stringify(location.state));
    }

    if (!sessionData) {
      navigate('/');
      return;
    }

    loadGameData();
    loadCourse();
    loadScoringConfig();

    if (socket) {
      socket.emit('join-game', gameId);

      socket.on('score-updated', handleScoreUpdate);
      socket.on('role-changed', handleRoleChanged);
      socket.on('username-changed', handleUsernameChanged);
      socket.on('turbo-updated', handleTurboUpdate);
      socket.on('player-added', handlePlayerAdded);
      socket.on('player-removed', handlePlayerRemoved);
      socket.on('scoring-config-updated', handleScoringConfigUpdate);

      return () => {
        socket.off('score-updated', handleScoreUpdate);
        socket.off('role-changed', handleRoleChanged);
        socket.off('username-changed', handleUsernameChanged);
        socket.off('turbo-updated', handleTurboUpdate);
        socket.off('player-added', handlePlayerAdded);
        socket.off('player-removed', handlePlayerRemoved);
        socket.off('scoring-config-updated', handleScoringConfigUpdate);
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

  const loadH2HMatrix = async () => {
    try {
      // Need course data and turboValues to calculate allocation
      if (!course || !turboValues) {
        console.log('Waiting for course and turboValues before loading H2H matrix');
        return;
      }

      const h2hResponse = await api.getHandicapMatrix(gameId);
      const { handicapMatrix } = h2hResponse.data;
      
      if (!handicapMatrix || Object.keys(handicapMatrix).length === 0) {
        console.log('No H2H matrix found');
        setRawH2hMatrix(null);
        setH2hStrokeAllocation(null);
        return;
      }
      
      console.log('H2H Matrix from server:', handicapMatrix);
      setRawH2hMatrix(handicapMatrix);
      
      // Convert H2H total strokes to per-hole allocation
      const strokeAlloc = {};
      const front9Holes = course.holes.filter(h => h.hole >= 1 && h.hole <= 9);
      const back9Holes = course.holes.filter(h => h.hole >= 10 && h.hole <= 18);
      
      for (const fromPlayerId in handicapMatrix) {
        strokeAlloc[fromPlayerId] = {};
        for (const toPlayerId in handicapMatrix[fromPlayerId]) {
          const front9Total = handicapMatrix[fromPlayerId][toPlayerId].front9 || 0;
          const back9Total = handicapMatrix[fromPlayerId][toPlayerId].back9 || 0;
          
          console.log(`Player ${fromPlayerId} -> ${toPlayerId}: F9=${front9Total}, B9=${back9Total}`);
          
          strokeAlloc[fromPlayerId][toPlayerId] = {
            front9: allocateStrokesFor9Holes(front9Total, front9Holes, turboValues),
            back9: allocateStrokesFor9Holes(back9Total, back9Holes, turboValues)
          };
        }
      }
      
      console.log('Converted H2H stroke allocation:', strokeAlloc);
      setH2hStrokeAllocation(strokeAlloc);
    } catch (err) {
      console.error('Failed to load H2H matrix:', err);
      setRawH2hMatrix(null);
      setH2hStrokeAllocation(null);
    }
  };

  const loadScoringConfig = async () => {
    try {
      const response = await api.getScoringConfig(gameId);
      console.log('Loaded scoring config:', response.data);
      setScoringConfig(response.data);
    } catch (err) {
      console.error('Failed to load scoring config:', err);
      // Set default values if loading fails
      setScoringConfig({ holeInOne: 10, eagle: 5, birdie: 2, parOrWorse: 1 });
    }
  };

  const loadCourse = async () => {
    try {
      const response = await api.getCourses();
      const gameResponse = await api.getGame(gameId);
      const courseData = response.data.find(c => c.id === gameResponse.data.game.course_id);
      setCourse(courseData);
      
      // Load turbo values from database
      try {
        const turboResponse = await api.getTurboValues(gameId);
        const turbos = turboResponse.data;
        
        // Initialize with course defaults if no database values
        if (Object.keys(turbos).length === 0 && courseData) {
          const defaultTurbos = {};
          courseData.holes.forEach(hole => {
            defaultTurbos[hole.hole] = hole.point || 1;
          });
          setTurboValues(defaultTurbos);
        } else {
          // Use database values, fill missing with 1
          const finalTurbos = {};
          if (courseData) {
            courseData.holes.forEach(hole => {
              finalTurbos[hole.hole] = turbos[hole.hole] || 1;
            });
          }
          setTurboValues(finalTurbos);
        }
      } catch (err) {
        console.error('Failed to load turbo values:', err);
        // Fallback to course defaults
        if (courseData) {
          const turbos = {};
          courseData.holes.forEach(hole => {
            turbos[hole.hole] = hole.point || 1;
          });
          setTurboValues(turbos);
        }
      }
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

  // Turbo multiplier functions
  const handleTurboDoubleTap = (holeNumber) => {
    if (!isCurrentUserHost) return;
    
    const now = Date.now();
    const lastTap = lastTapTime[holeNumber] || 0;
    const timeSinceLastTap = now - lastTap;
    
    if (timeSinceLastTap < 300 && timeSinceLastTap > 0 && lastTapHole === holeNumber) {
      // Double tap detected
      setShowTurboDropdown(holeNumber);
      setLastTapTime({});
      setLastTapHole(null);
    } else {
      // First tap
      setLastTapTime({ ...lastTapTime, [holeNumber]: now });
      setLastTapHole(holeNumber);
    }
  };

  const updateTurboValue = async (holeNumber, multiplier) => {
    setTurboValues(prev => ({
      ...prev,
      [holeNumber]: multiplier
    }));
    setShowTurboDropdown(null);
    
    // Save to database
    try {
      await api.updateTurboValue(gameId, { holeNumber, multiplier });
    } catch (err) {
      console.error('Failed to save turbo value:', err);
    }
    
    // Broadcast to other players
    if (socket) {
      socket.emit('turbo-update', { gameId, holeNumber, multiplier });
    }
  };

  const handleTurboUpdate = ({ holeNumber, multiplier }) => {
    setTurboValues(prev => ({
      ...prev,
      [holeNumber]: multiplier
    }));
  };

  const handlePlayerAdded = (player) => {
    setPlayers(prev => {
      // Check if player already exists
      if (prev.some(p => p.id === player.id)) return prev;
      return [...prev, player];
    });
    // Trigger H2H matrix reload when new player joins
    console.log('Player added, triggering H2H reload');
    setH2hReloadTrigger(prev => prev + 1);
  };

  const handlePlayerRemoved = (playerId) => {
    setPlayers(prev => prev.filter(p => p.id !== playerId));
    // Trigger H2H matrix reload when player leaves
    console.log('Player removed, triggering H2H reload');
    setH2hReloadTrigger(prev => prev + 1);
  };

  const handleScoringConfigUpdate = (config) => {
    console.log('Scoring config updated:', config);
    setScoringConfig(config);
  };

  // Player management functions
  const handleAddPlayer = async (username, role) => {
    try {
      const response = await api.addPlayer(gameId, { username, role });
      const newPlayer = response.data;
      setPlayers(prev => [...prev, newPlayer]);
      
      // Broadcast to other players
      if (socket) {
        socket.emit('player-added', { gameId, player: newPlayer });
      }
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
      
      // Broadcast to other players
      if (socket) {
        socket.emit('player-removed', { gameId, playerId });
      }
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

  const handleLeaveGame = () => {
    // Clear session from localStorage
    localStorage.removeItem(`game_session_${gameId}`);
    // Navigate to home
    navigate('/');
  };

  const handleSaveScoringConfig = async (config) => {
    try {
      await api.updateScoringConfig(gameId, config, currentPlayerId);
      console.log('Scoring config saved successfully');
      setScoringConfig(config);
    } catch (err) {
      console.error('Failed to save scoring config:', err);
      throw err; // Re-throw for modal to handle
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
          <div style={{flex: 1, minWidth: '200px'}}>
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
                  cursor: 'pointer',
                  maxWidth: '200px'
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
          <button 
            className="btn-hamburger-menu" 
            onClick={() => setShowHamburgerMenu(!showHamburgerMenu)}
          >
            <div className="hamburger-icon">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </button>
        </div>

        {/* Hamburger Menu */}
        {showHamburgerMenu && (
          <div className="hamburger-menu-overlay" onClick={() => setShowHamburgerMenu(false)}>
            <div className="hamburger-menu-panel" onClick={(e) => e.stopPropagation()}>
              <div className="hamburger-menu-header">
                <h3>เมนู</h3>
                <button 
                  className="btn-close-hamburger"
                  onClick={() => setShowHamburgerMenu(false)}
                >
                  ✕
                </button>
              </div>
              <div className="hamburger-menu-items">
                <button 
                  className="hamburger-menu-item"
                  onClick={() => {
                    setShowHamburgerMenu(false);
                    setShowPlayersMenu(true);
                  }}
                >
                  <span className="menu-icon">👥</span>
                  <span>จัดการผู้เล่น ({players.length})</span>
                </button>
                <button 
                  className="hamburger-menu-item"
                  onClick={() => {
                    setShowHamburgerMenu(false);
                    navigate(`/game/${gameId}/handicap`);
                  }}
                >
                  <span className="menu-icon">⚖️</span>
                  <span>ตั้งค่าแต้มต่อ H2H</span>
                </button>
                {isHost && (
                  <button 
                    className="hamburger-menu-item"
                    onClick={() => {
                      setShowHamburgerMenu(false);
                      setShowScoringConfigModal(true);
                    }}
                  >
                    <span className="menu-icon">🎯</span>
                    <span>H2H Scoring Config</span>
                  </button>
                )}
                <button 
                  className="hamburger-menu-item"
                  onClick={() => {
                    setShowHamburgerMenu(false);
                    setShowVersionModal(true);
                  }}
                >
                  <span className="menu-icon">ℹ️</span>
                  <span>Version Info</span>
                </button>
                <button 
                  className="hamburger-menu-item danger"
                  onClick={handleLeaveGame}
                >
                  <span className="menu-icon">🚪</span>
                  <span>ออกจากเกม</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Version Info Modal */}
        {showVersionModal && versionInfo && (
          <div className="version-modal-overlay" onClick={() => setShowVersionModal(false)}>
            <div className="version-modal-panel" onClick={(e) => e.stopPropagation()}>
              <div className="version-modal-header">
                <h3>Version Information</h3>
                <button 
                  className="btn-close-version"
                  onClick={() => setShowVersionModal(false)}
                >
                  ✕
                </button>
              </div>
              <div className="version-modal-content">
                <div className="version-item">
                  <span className="version-label">Version:</span>
                  <span className="version-value">{versionInfo.version}</span>
                </div>
                <div className="version-item">
                  <span className="version-label">Build Time:</span>
                  <span className="version-value">{new Date(versionInfo.buildTime).toLocaleString('th-TH')}</span>
                </div>
                <div className="version-item">
                  <span className="version-label">Git Commit:</span>
                  <span className="version-value">{versionInfo.gitCommit.substring(0, 7)}</span>
                </div>
                <div className="version-item">
                  <span className="version-label">Environment:</span>
                  <span className="version-value">{versionInfo.environment}</span>
                </div>
              </div>
            </div>
          </div>
        )}

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
                <th className="hole-par-col-vertical">Hole</th>
                {sortedPlayers.map((player, index) => {
                  // Calculate H2H handicap display for header
                  let handicapInfo = '';
                  if (index === 0) {
                    // Focus player - show their handicap
                    handicapInfo = player.handicap ? ` (${player.handicap})` : '';
                  } else {
                    // Other players - show stroke relationship
                    const strokeDiff = (player.handicap || 0) - (sortedPlayers[0].handicap || 0);
                    if (strokeDiff > 0) {
                      // Focus player gives strokes (red -)
                      handicapInfo = ` (-${strokeDiff})`;
                    } else if (strokeDiff < 0) {
                      // Focus player receives strokes (green +)
                      handicapInfo = ` (+${Math.abs(strokeDiff)})`;
                    }
                  }
                  
                  return (
                    <th key={player.id} className="player-col-vertical">
                      <div>{player.username.trim()}</div>
                      {handicapInfo && (
                        <div style={{
                          fontSize: '0.75rem',
                          fontWeight: 'normal',
                          color: index === 0 ? '#666' : (handicapInfo.startsWith(' (+') ? 'green' : 'red'),
                          marginTop: '2px'
                        }}>
                          {handicapInfo}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {course.holes.slice(0, 9).map((hole, idx) => (
                <tr key={idx} className={turboValues[hole.hole] > 1 ? 'turbo-row' : ''}>
                  <td 
                    className="hole-par-col-vertical"
                    onClick={() => handleTurboDoubleTap(hole.hole)}
                    onDoubleClick={() => isCurrentUserHost && setShowTurboDropdown(hole.hole)}
                    style={{ 
                      position: 'relative', 
                      cursor: isCurrentUserHost ? 'pointer' : 'default', 
                      userSelect: 'none',
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none'
                    }}
                  >
                    <div className="hole-par-combined">
                      <div className="hole-number-vertical">
                        {hole.hole}
                        {turboValues[hole.hole] > 1 && <span className="turbo-badge">x{turboValues[hole.hole]}</span>}
                      </div>
                      {showTurboDropdown === hole.hole && (
                        <select
                          className="turbo-dropdown"
                          value={turboValues[hole.hole] || 1}
                          onChange={(e) => updateTurboValue(hole.hole, parseInt(e.target.value))}
                          onBlur={() => setShowTurboDropdown(null)}
                          autoFocus
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 1000,
                            fontSize: '0.9rem',
                            padding: '0.25rem',
                            borderRadius: '0.25rem',
                            border: '1px solid #ddd',
                            background: 'white',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                          }}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                            <option key={num} value={num}>x{num}</option>
                          ))}
                        </select>
                      )}
                      <div className="par-hc-group">
                        <div className="par-value">Par {hole.par}</div>
                        <div className="hc-value">HC {hole.hc}</div>
                      </div>
                    </div>
                  </td>
                  {sortedPlayers.map((player, index) => {
                    const handicapDisplay = getStrokeDisplay(strokeAllocation, effectiveViewPlayerId, player.id, hole.hole);
                    console.log(`Hole ${hole.hole}, Player ${player.username}:`, handicapDisplay);
                    
                    // Determine numeric display with color (skip turbo holes)
                    const isTurboHole = turboValues[hole.hole] > 1;
                    let strokeIndicator = null;
                    if (!isTurboHole && handicapDisplay.count !== 0) {
                      const absCount = Math.abs(handicapDisplay.count);
                      strokeIndicator = {
                        count: absCount,
                        color: handicapDisplay.count > 0 ? '#4caf50' : '#f44336' // green for receiving, red for giving
                      };
                    }
                    
                    return (
                      <td key={player.id} className={`score-cell-vertical ${index === 0 ? 'focus-player' : ''}`}>
                        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'visible' }}>
                          {/* Numeric handicap indicator */}
                          {strokeIndicator && (
                            <div 
                              className="handicap-indicator"
                              style={{
                                position: 'absolute',
                                top: '2px',
                                right: '2px',
                                fontSize: '0.875rem',
                                fontWeight: 'bold',
                                color: strokeIndicator.color,
                                zIndex: 2,
                                lineHeight: 1,
                                pointerEvents: 'none'
                              }}
                            >
                              {strokeIndicator.count}
                            </div>
                          )}
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
                            <div style={{fontSize: '1rem', color: '#999', textAlign: 'center', width: '100%'}}>-</div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Front 9 Total */}
              <tr className="total-row">
                <td className="hole-par-col-vertical"><strong>1-9</strong></td>
                {sortedPlayers.map((player, index) => (
                  <td key={player.id} className={`total-cell ${index === 0 ? 'focus-player' : ''}`}>
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
                <th className="hole-par-col-vertical">Hole</th>
                {sortedPlayers.map((player, index) => {
                  // Calculate H2H handicap display for header
                  let handicapInfo = '';
                  if (index === 0) {
                    // Focus player - show their handicap
                    handicapInfo = player.handicap ? ` (${player.handicap})` : '';
                  } else {
                    // Other players - show stroke relationship
                    const strokeDiff = (player.handicap || 0) - (sortedPlayers[0].handicap || 0);
                    if (strokeDiff > 0) {
                      // Focus player gives strokes (red -)
                      handicapInfo = ` (-${strokeDiff})`;
                    } else if (strokeDiff < 0) {
                      // Focus player receives strokes (green +)
                      handicapInfo = ` (+${Math.abs(strokeDiff)})`;
                    }
                  }
                  
                  return (
                    <th key={player.id} className="player-col-vertical">
                      <div>{player.username.trim()}</div>
                      {handicapInfo && (
                        <div style={{
                          fontSize: '0.75rem',
                          fontWeight: 'normal',
                          color: index === 0 ? '#666' : (handicapInfo.startsWith(' (+') ? 'green' : 'red'),
                          marginTop: '2px'
                        }}>
                          {handicapInfo}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {course.holes.slice(9, 18).map((hole, idx) => (
                <tr key={idx} className={turboValues[hole.hole] > 1 ? 'turbo-row' : ''}>
                  <td 
                    className="hole-par-col-vertical"
                    onClick={() => handleTurboDoubleTap(hole.hole)}
                    onDoubleClick={() => isCurrentUserHost && setShowTurboDropdown(hole.hole)}
                    style={{ 
                      position: 'relative', 
                      cursor: isCurrentUserHost ? 'pointer' : 'default', 
                      userSelect: 'none',
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none'
                    }}
                  >
                    <div className="hole-par-combined">
                      <div className="hole-number-vertical">
                        {hole.hole}
                        {turboValues[hole.hole] > 1 && <span className="turbo-badge">x{turboValues[hole.hole]}</span>}
                      </div>
                      {showTurboDropdown === hole.hole && (
                        <select
                          className="turbo-dropdown"
                          value={turboValues[hole.hole] || 1}
                          onChange={(e) => updateTurboValue(hole.hole, parseInt(e.target.value))}
                          onBlur={() => setShowTurboDropdown(null)}
                          autoFocus
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 1000,
                            fontSize: '0.9rem',
                            padding: '0.25rem',
                            borderRadius: '0.25rem',
                            border: '1px solid #ddd',
                            background: 'white',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                          }}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                            <option key={num} value={num}>x{num}</option>
                          ))}
                        </select>
                      )}
                      <div className="par-hc-group">
                        <div className="par-value">Par {hole.par}</div>
                        <div className="hc-value">HC {hole.hc}</div>
                      </div>
                    </div>
                  </td>
                  {sortedPlayers.map((player, index) => {
                    const handicapDisplay = getStrokeDisplay(strokeAllocation, effectiveViewPlayerId, player.id, hole.hole);
                    
                    // Determine numeric display with color (skip turbo holes)
                    const isTurboHole = turboValues[hole.hole] > 1;
                    let strokeIndicator = null;
                    if (!isTurboHole && handicapDisplay.count !== 0) {
                      const absCount = Math.abs(handicapDisplay.count);
                      strokeIndicator = {
                        count: absCount,
                        color: handicapDisplay.count > 0 ? '#4caf50' : '#f44336' // green for receiving, red for giving
                      };
                    }
                    
                    return (
                      <td key={player.id} className={`score-cell-vertical ${index === 0 ? 'focus-player' : ''}`}>
                        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'visible' }}>
                          {/* Numeric handicap indicator */}
                          {strokeIndicator && (
                            <div 
                              className="handicap-indicator"
                              style={{
                                position: 'absolute',
                                top: '2px',
                                right: '2px',
                                fontSize: '0.875rem',
                                fontWeight: 'bold',
                                color: strokeIndicator.color,
                                zIndex: 2,
                                lineHeight: 1,
                                pointerEvents: 'none'
                              }}
                            >
                              {strokeIndicator.count}
                            </div>
                          )}
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
                            <div style={{fontSize: '1rem', color: '#999', textAlign: 'center', width: '100%'}}>-</div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Back 9 Total */}
              <tr className="total-row">
                <td className="hole-par-col-vertical"><strong>10-18</strong></td>
                {sortedPlayers.map((player, index) => (
                  <td key={player.id} className={`total-cell ${index === 0 ? 'focus-player' : ''}`}>
                    <strong>{calculateBack9(player.id)}</strong>
                  </td>
                ))}
              </tr>
              {/* Grand Total */}
              <tr className="total-row final-row">
                <td className="hole-par-col-vertical"><strong>Total</strong></td>
                {sortedPlayers.map((player, index) => (
                  <td key={player.id} className={`total-cell final ${index === 0 ? 'focus-player' : ''}`}>
                    <strong>{calculateTotal(player.id)}</strong>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Scoring Config Modal */}
      <ScoringConfigModal
        isOpen={showScoringConfigModal}
        onClose={() => setShowScoringConfigModal(false)}
        currentConfig={scoringConfig}
        onSave={handleSaveScoringConfig}
      />
    </div>
  );
}

export default GamePlay;
