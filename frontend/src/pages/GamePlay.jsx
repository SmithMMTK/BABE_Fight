import { useState, useEffect, useMemo, useCallback, memo, lazy, Suspense } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { api } from '../services/api';
import PlayersMenu from '../components/PlayersMenu';
import { calculateStrokeAllocation, getStrokeDisplay, allocateStrokesFor9Holes } from '../utils/strokeAllocation';

// Lazy load modals - loaded only when needed
const ScoringConfigModal = lazy(() => import('../components/ScoringConfigModal'));
const TurboConfigModal = lazy(() => import('../components/TurboConfigModal'));
const AnimalInputModal = lazy(() => import('../components/AnimalInputModal'));
const AnimalSummaryModal = lazy(() => import('../components/AnimalSummaryModal'));
import { calculateH2HScoring, formatH2HDebugOutput } from '../utils/h2hScoring';
import { calculateAnimalScores } from '../utils/animalScoring';
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
  const [showTurboConfigModal, setShowTurboConfigModal] = useState(false);
  const [h2hStrokeAllocation, setH2hStrokeAllocation] = useState(null); // H2H handicap matrix from server
  const [rawH2hMatrix, setRawH2hMatrix] = useState(null); // Raw H2H matrix from database
  const [h2hReloadTrigger, setH2hReloadTrigger] = useState(0); // Trigger to force H2H reload
  const [scoringConfig, setScoringConfig] = useState(null); // H2H scoring configuration (hole-in-one, eagle, birdie, par or worse)
  const [showScoringConfigModal, setShowScoringConfigModal] = useState(false);
  const [editingScoreCell, setEditingScoreCell] = useState(null); // {playerId, holeNumber} for cell being edited
  const [animalScores, setAnimalScores] = useState([]); // Animal penalty scores
  const [showAnimalModal, setShowAnimalModal] = useState(false);
  const [selectedAnimalHole, setSelectedAnimalHole] = useState(null);
  const [showAnimalSummary, setShowAnimalSummary] = useState(false);
  const [showBackNineFirst, setShowBackNineFirst] = useState(false); // Toggle front/back nine display order

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

  // Load toggle state from localStorage on mount
  useEffect(() => {
    const savedToggle = localStorage.getItem(`showBackNineFirst_${gameId}`);
    if (savedToggle !== null) {
      setShowBackNineFirst(savedToggle === 'true');
    }
  }, [gameId]);

  // Save toggle state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(`showBackNineFirst_${gameId}`, showBackNineFirst.toString());
  }, [showBackNineFirst, gameId]);

  // Calculate stroke allocation for H2H handicap
  // Use H2H matrix from server if available, otherwise calculate from player handicaps
  const strokeAllocation = useMemo(() => {
    if (!course || !players || players.length === 0) return {};
    
    // If we have H2H data from server, use it directly
    if (h2hStrokeAllocation) {
      return h2hStrokeAllocation;
    }
    
    // Fallback: Calculate from player handicaps
    const allocation = calculateStrokeAllocation(players, course.holes, turboValues);
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
  // Performance: Debounce to avoid excessive recalculations
  useEffect(() => {
    if (!course || !turboValues || Object.keys(turboValues).length === 0) return;
    
    const timeoutId = setTimeout(() => {
      loadH2HMatrix();
    }, 300); // Debounce by 300ms
    
    return () => clearTimeout(timeoutId);
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
      socket.on('turbo-bulk-update', handleTurboBulkUpdate);
      socket.on('player-added', handlePlayerAdded);
      socket.on('player-removed', handlePlayerRemoved);
      socket.on('scoring-config-updated', handleScoringConfigUpdate);
      socket.on('animal-updated', handleAnimalUpdate);

      return () => {
        socket.off('score-updated', handleScoreUpdate);
        socket.off('role-changed', handleRoleChanged);
        socket.off('username-changed', handleUsernameChanged);
        socket.off('turbo-updated', handleTurboUpdate);
        socket.off('turbo-bulk-update', handleTurboBulkUpdate);
        socket.off('player-added', handlePlayerAdded);
        socket.off('player-removed', handlePlayerRemoved);
        socket.off('scoring-config-updated', handleScoringConfigUpdate);
        socket.off('animal-updated', handleAnimalUpdate);
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

      // Load animal scores
      const animalResponse = await api.getAnimalScores(gameId);
      setAnimalScores(animalResponse.data.animalScores || []);

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
        return;
      }

      const h2hResponse = await api.getHandicapMatrix(gameId);
      const { handicapMatrix } = h2hResponse.data;
      
      if (!handicapMatrix || Object.keys(handicapMatrix).length === 0) {
        setRawH2hMatrix(null);
        setH2hStrokeAllocation(null);
        return;
      }
      
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
          
          
          strokeAlloc[fromPlayerId][toPlayerId] = {
            front9: allocateStrokesFor9Holes(front9Total, front9Holes, turboValues),
            back9: allocateStrokesFor9Holes(back9Total, back9Holes, turboValues)
          };
        }
      }
      
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
      setScoringConfig(response.data);
    } catch (err) {
      console.error('[Scoring Config] Failed to load:', err);
      // Set default values if loading fails
      setScoringConfig({ holeInOne: 10, albatross: 10, eagle: 5, birdie: 2, parOrWorse: 1 });
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
  const handleSaveTurboConfig = async (newTurboValues) => {
    // Save all turbo values to database
    try {
      for (const [hole, multiplier] of Object.entries(newTurboValues)) {
        await api.updateTurboValue(gameId, { holeNumber: parseInt(hole), multiplier });
      }
      
      setTurboValues(newTurboValues);
      
      // Broadcast to other players
      if (socket) {
        socket.emit('turbo-bulk-update', { gameId, turboValues: newTurboValues });
      }
    } catch (err) {
      console.error('Failed to save turbo configuration:', err);
      throw err; // Let modal handle the error
    }
  };

  const handleTurboUpdate = ({ holeNumber, multiplier }) => {
    setTurboValues(prev => ({
      ...prev,
      [holeNumber]: multiplier
    }));
  };

  const handleTurboBulkUpdate = ({ turboValues: newValues }) => {
    setTurboValues(newValues);
  };

  const handlePlayerAdded = (player) => {
    setPlayers(prev => {
      // Check if player already exists
      if (prev.some(p => p.id === player.id)) return prev;
      return [...prev, player];
    });
    // Trigger H2H matrix reload when new player joins
    setH2hReloadTrigger(prev => prev + 1);
  };

  const handlePlayerRemoved = (playerId) => {
    setPlayers(prev => prev.filter(p => p.id !== playerId));
    // Trigger H2H matrix reload when player leaves
    setH2hReloadTrigger(prev => prev + 1);
  };

  const handleScoringConfigUpdate = (config) => {
    setScoringConfig(config);
  };

  const handleAnimalUpdate = async ({ holeNumber }) => {
    // Reload animal scores when updated by another player
    try {
      const animalResponse = await api.getAnimalScores(gameId);
      setAnimalScores(animalResponse.data.animalScores || []);
    } catch (err) {
      console.error('Failed to reload animal scores:', err);
    }
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
      setScoringConfig(config);
    } catch (err) {
      console.error('Failed to save scoring config:', err);
      throw err; // Re-throw for modal to handle
    }
  };

  const handleSaveAnimalScores = async (holeNumber, animalCounts) => {
    try {
      // Send all players' scores in one request
      await api.updateAnimalScores(gameId, {
        holeNumber,
        animals: animalCounts // { playerId: { animalType: count } }
      });

      // Reload animal scores
      const animalResponse = await api.getAnimalScores(gameId);
      setAnimalScores(animalResponse.data.animalScores || []);

      // Broadcast to others via socket
      if (socket) {
        socket.emit('animal-update', { gameId, holeNumber });
      }
    } catch (err) {
      console.error('Failed to save animal scores:', err);
      alert('ไม่สามารถบันทึกคะแนน Animal ได้');
    }
  };

  // Single click handler for animal modal
  const handleOpenAnimalModal = (holeNumber) => {
    setSelectedAnimalHole(holeNumber);
    setShowAnimalModal(true);
  };

  // Get animal indicator for a player on a specific hole
  const getAnimalIndicator = (playerId, holeNumber) => {
    // Find all animal scores for this player on this hole
    const holeAnimalScores = animalScores.filter(
      score => score.player_id === playerId && score.hole_number === holeNumber
    );
    
    if (holeAnimalScores.length === 0) return null;
    
    // Calculate total animal penalty with turbo multiplier
    const turbo = turboValues[holeNumber] || 1;
    const totalPenalty = holeAnimalScores.reduce((sum, score) => sum + (score.count * turbo), 0);
    
    if (totalPenalty === 0) return null;
    
    return {
      penalty: totalPenalty,
      display: totalPenalty === 1 ? 'a' : `a+${totalPenalty}`
    };
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

  const handleScoreSelect = (score) => {
    if (editingScoreCell) {
      updateScore(editingScoreCell.playerId, editingScoreCell.holeNumber, score);
      setEditingScoreCell(null);
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

  // Dynamic calculation based on toggle state
  const calculateFirstNine = (playerId) => {
    if (!scores[playerId] || !course) return 0;
    const start = showBackNineFirst ? 9 : 0;
    const end = showBackNineFirst ? 18 : 9;
    return course.holes.slice(start, end).reduce((sum, hole) => 
      sum + (scores[playerId][hole.hole] || 0), 0);
  };

  const calculateSecondNine = (playerId) => {
    if (!scores[playerId] || !course) return 0;
    const start = showBackNineFirst ? 0 : 9;
    const end = showBackNineFirst ? 9 : 18;
    return course.holes.slice(start, end).reduce((sum, hole) => 
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

  // Function to calculate H2H indicator for a specific hole
  const getH2HIndicator = (viewPlayerId, opponentId, holeNumber) => {
    // Need all required data
    if (!course || !scoringConfig || !scores[viewPlayerId] || !scores[opponentId]) {
      return null;
    }

    const hole = course.holes.find(h => h.hole === holeNumber);
    if (!hole) return null;

    const playerScore = scores[viewPlayerId][holeNumber];
    const opponentScore = scores[opponentId][holeNumber];

    // Both scores must exist
    if (!playerScore || !opponentScore) return null;

    // Get handicap for this hole
    const handicapDisplay = getStrokeDisplay(strokeAllocation, viewPlayerId, opponentId, holeNumber);
    let hc = { type: 'None', value: 0 };
    if (handicapDisplay.count > 0) {
      hc = { type: `Get${handicapDisplay.count}`, value: handicapDisplay.count };
    } else if (handicapDisplay.count < 0) {
      hc = { type: `Give${Math.abs(handicapDisplay.count)}`, value: Math.abs(handicapDisplay.count) };
    }

    // Calculate net scores
    let playerNet = playerScore;
    let opponentNet = opponentScore;
    
    if (hc.type.startsWith('Get')) {
      playerNet = playerScore - hc.value;
    } else if (hc.type.startsWith('Give')) {
      opponentNet = opponentScore - hc.value;
    }

    // Determine result
    let result;
    if (playerNet < opponentNet) {
      result = 'WIN';
    } else if (playerNet > opponentNet) {
      result = 'LOSE';
    } else {
      result = 'TIE';
    }

    // Determine ScoreType
    let grossToEvaluate;
    if (result === 'WIN') {
      grossToEvaluate = playerScore;
    } else if (result === 'LOSE') {
      grossToEvaluate = opponentScore;
    } else {
      grossToEvaluate = playerScore;
    }

    const par = hole.par;
    let scoreType;
    if (par === 3 && grossToEvaluate === 1) {
      scoreType = 'HIO';
    } else if (grossToEvaluate <= par - 3) {
      scoreType = 'Albatross';
    } else if (grossToEvaluate === par - 2) {
      scoreType = 'Eagle';
    } else if (grossToEvaluate === par - 1) {
      scoreType = 'Birdie';
    } else {
      scoreType = 'Par';
    }

    // Get BasePoint
    let basePoint;
    if (scoreType === 'HIO') {
      basePoint = scoringConfig.holeInOne || scoringConfig.HIO || 10;
    } else if (scoreType === 'Albatross') {
      basePoint = scoringConfig.albatross || scoringConfig.Albatross || 10;
    } else if (scoreType === 'Eagle') {
      basePoint = scoringConfig.eagle || scoringConfig.Eagle || 5;
    } else if (scoreType === 'Birdie') {
      basePoint = scoringConfig.birdie || scoringConfig.Birdie || 2;
    } else {
      basePoint = scoringConfig.parOrWorse || scoringConfig.Par || 1;
    }

    // Get turbo
    const turbo = turboValues[holeNumber] || 1;
    const holePoint = basePoint * turbo;

    // Calculate PlayerDelta
    let playerDelta = 0;
    if (result === 'WIN') {
      playerDelta = holePoint;
    } else if (result === 'LOSE') {
      playerDelta = -holePoint;
    } else if (result === 'TIE') {
      // Check if opponent shot under par (penalty)
      if (opponentScore < par) {
        let opponentScoreType;
        if (par === 3 && opponentScore === 1) {
          opponentScoreType = 'HIO';
        } else if (opponentScore <= par - 3) {
          opponentScoreType = 'Albatross';
        } else if (opponentScore === par - 2) {
          opponentScoreType = 'Eagle';
        } else if (opponentScore === par - 1) {
          opponentScoreType = 'Birdie';
        }
        
        let penaltyBasePoint;
        if (opponentScoreType === 'HIO') {
          penaltyBasePoint = scoringConfig.holeInOne || scoringConfig.HIO || 10;
        } else if (opponentScoreType === 'Albatross') {
          penaltyBasePoint = scoringConfig.albatross || scoringConfig.Albatross || 10;
        } else if (opponentScoreType === 'Eagle') {
          penaltyBasePoint = scoringConfig.eagle || scoringConfig.Eagle || 5;
        } else if (opponentScoreType === 'Birdie') {
          penaltyBasePoint = scoringConfig.birdie || scoringConfig.Birdie || 2;
        }
        
        const penaltyHolePoint = penaltyBasePoint * turbo;
        const parPoints = scoringConfig.parOrWorse || scoringConfig.Par || 1;
        const parHolePoint = parPoints * turbo;
        playerDelta = -(penaltyHolePoint - parHolePoint);
      } else if (hc.type !== 'None' && playerScore < par) {
        // Normal TIE bonus
        const parPoints = scoringConfig.parOrWorse || scoringConfig.Par || 1;
        playerDelta = (basePoint - parPoints) * turbo;
      }
    }

    return playerDelta;
  };

  // Function to calculate H2H total for a range of holes
  const getH2HTotalForHoles = (viewPlayerId, opponentId, startHole, endHole) => {
    let total = 0;
    for (let h = startHole; h <= endHole; h++) {
      const delta = getH2HIndicator(viewPlayerId, opponentId, h);
      if (delta) {
        total += delta;
      }
    }
    return total;
  };

  return (
    <div className="container gameplay-container">
      <div className="game-header">
        <div className="header-row">
          <div style={{flex: 1, minWidth: '200px'}}>
            <h1>{game?.course_name}</h1>
            <div style={{
              fontSize: '1.2rem',
              fontWeight: '700',
              color: '#2c3e50',
              marginTop: '0.5rem',
              marginBottom: '0.5rem'
            }}>
              {displayName}
            </div>
            {isCurrentUserHost && (
              <select 
                value={effectiveViewPlayerId || ''} 
                onChange={(e) => setViewAsPlayerId(e.target.value ? parseInt(e.target.value) : null)}
                aria-label="เลือกมุมมองผู้เล่น"
                style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  borderRadius: '0.5rem',
                  border: '2px solid #3498db',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  maxWidth: '250px',
                  color: '#2c3e50'
                }}
              >
                <option value="" style={{fontWeight: '700'}}>View as: {displayName} (Me)</option>
                {players.filter(p => p.id !== currentPlayerId).map(player => (
                  <option key={player.id} value={player.id}>
                    View as: {player.username}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            className="btn-toggle-holes"
            onClick={() => setShowBackNineFirst(!showBackNineFirst)}
            aria-label="สลับลำดับการแสดงหลุม"
            title="กดเพื่อสลับลำดับหลุม"
          >
            <span className="toggle-icon">🔄</span>
            <span className="toggle-label">แสดง:</span>
            <span className="toggle-text">{showBackNineFirst ? 'Back-Front' : 'Front-Back'}</span>
          </button>
          <button 
            className="btn-hamburger-menu" 
            onClick={() => setShowHamburgerMenu(!showHamburgerMenu)}
            aria-label="เปิดเมนู"
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
                <button 
                  className="hamburger-menu-item"
                  onClick={() => {
                    setShowHamburgerMenu(false);
                    setShowTurboConfigModal(true);
                  }}
                >
                  <span className="menu-icon">⚡</span>
                  <span>กำหนดหลุมเทอร์โบ{!isHost && ' (ดูอย่างเดียว)'}</span>
                </button>
                <button 
                  className="hamburger-menu-item"
                  onClick={() => {
                    setShowHamburgerMenu(false);
                    setShowScoringConfigModal(true);
                  }}
                >
                  <span className="menu-icon">🎯</span>
                  <span>H2H Scoring Config{!isHost && ' (ดูอย่างเดียว)'}</span>
                </button>
                <button 
                  className="hamburger-menu-item"
                  onClick={() => {
                    setShowHamburgerMenu(false);
                    setShowAnimalSummary(true);
                  }}
                >
                  <span className="menu-icon">🐾</span>
                  <span>สรุป Animal Scores</span>
                </button>
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
                  className="hamburger-menu-item"
                  onClick={() => {
                    setShowHamburgerMenu(false);
                    console.clear();
                    console.log('=== H2H Scoring Calculation (All Matchups) ===');
                    
                    if (sortedPlayers.length >= 2 && course && scoringConfig) {
                      // Loop through each player as viewPlayer
                      sortedPlayers.forEach((vPlayer, vIdx) => {
                        // vs each opponent
                        sortedPlayers.forEach((opp, oIdx) => {
                          if (vIdx === oIdx) return; // skip self
                          
                          // Prepare handicaps
                          const handicaps = {};
                          for (let h = 1; h <= 18; h++) {
                            const hc = getStrokeDisplay(strokeAllocation, vPlayer.id, opp.id, h);
                            if (hc.count > 0) {
                              handicaps[h] = { type: `Get${hc.count}`, value: hc.count };
                            } else if (hc.count < 0) {
                              handicaps[h] = { type: `Give${Math.abs(hc.count)}`, value: Math.abs(hc.count) };
                            } else {
                              handicaps[h] = { type: 'None', value: 0 };
                            }
                          }
                          
                          // Calculate H2H
                          const result = calculateH2HScoring({
                            h2hConfig: scoringConfig,
                            playerName: vPlayer.username,
                            opponentName: opp.username,
                            holes: course.holes,
                            playerScores: scores[vPlayer.id] || {},
                            opponentScores: scores[opp.id] || {},
                            handicaps,
                            turboValues
                          });
                          
                          // Format and display
                          formatH2HDebugOutput(result);
                        });
                      });
                    }
                    
                    // Animal Scores Debug
                    console.log('\n=== Animal Scores Summary ===');
                    if (sortedPlayers.length > 0) {
                      const animalTypes = [
                        { type: 'monkey', label: 'Monkey', emoji: '🐒' },
                        { type: 'giraffe', label: 'Giraffe', emoji: '🦒' },
                        { type: 'snake', label: 'Snake', emoji: '🐍' },
                        { type: 'camel', label: 'Camel', emoji: '🐪' },
                        { type: 'frog', label: 'Frog', emoji: '🐸' },
                        { type: 'monitor_lizard', label: 'Monitor Lizard', emoji: '🐊' }
                      ];
                      
                      sortedPlayers.forEach(player => {
                        console.log(`\n${player.username}:`);
                        let totalAnimals = 0;
                        let totalPenalty = 0;
                        const animalBreakdown = {};
                        
                        // Calculate per animal type
                        animalTypes.forEach(animal => {
                          let count = 0;
                          let penalty = 0;
                          
                          for (let hole = 1; hole <= 18; hole++) {
                            if (animalScores[hole] && animalScores[hole][player.id] && animalScores[hole][player.id][animal.type]) {
                              const animalCount = animalScores[hole][player.id][animal.type];
                              const turbo = turboValues[hole] || 1;
                              count += animalCount;
                              penalty += animalCount * turbo;
                            }
                          }
                          
                          if (count > 0) {
                            animalBreakdown[animal.type] = { count, penalty };
                            totalAnimals += count;
                            totalPenalty += penalty;
                          }
                        });
                        
                        // Display breakdown
                        animalTypes.forEach(animal => {
                          if (animalBreakdown[animal.type]) {
                            const { count, penalty } = animalBreakdown[animal.type];
                            console.log(`  ${animal.emoji} ${animal.label}: ${count} animals → +${penalty} penalty`);
                          }
                        });
                        
                        console.log(`  Total: ${totalAnimals} animals → +${totalPenalty} penalty points`);
                      });
                      
                      // Show holes with turbo multipliers
                      const turboHoles = Object.keys(turboValues).filter(h => turboValues[h] > 1);
                      if (turboHoles.length > 0) {
                        console.log('\n=== Turbo Holes ===');
                        turboHoles.forEach(hole => {
                          console.log(`  Hole ${hole}: ${turboValues[hole]}x multiplier`);
                        });
                      }
                    }
                  }}
                >
                  <span className="menu-icon">🐛</span>
                  <span>Debug H1-H18</span>
                </button>
                <button 
                  className="hamburger-menu-item danger"
                  onClick={handleLeaveGame}
                >
                  <span className="menu-icon">🚪</span>
                  <span>ออกจากเกม</span>
                </button>
              </div>
```
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

        {/* Score Selection Modal */}
        {editingScoreCell && course && (
          <div className="score-modal-overlay" onClick={() => setEditingScoreCell(null)}>
            <div className="score-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="score-modal-title">
                {(() => {
                  const hole = course.holes.find(h => h.hole === editingScoreCell.holeNumber);
                  const player = players.find(p => p.id === editingScoreCell.playerId);
                  return `${player?.username} - Hole ${editingScoreCell.holeNumber} (Par ${hole?.par || '-'})`;
                })()}
              </div>
              <div className="score-modal-grid">
                {(() => {
                  const hole = course.holes.find(h => h.hole === editingScoreCell.holeNumber);
                  if (!hole) return null;
                  return getScoreOptions(hole.par).map(option => {
                    const currentScore = scores[editingScoreCell.playerId]?.[editingScoreCell.holeNumber];
                    const isCurrent = currentScore === option.value;
                    const scoreName = getScoreLabel(option.value, hole.par);
                    return (
                      <button
                        key={option.value}
                        className={`score-modal-option ${isCurrent ? 'current' : ''}`}
                        onClick={() => handleScoreSelect(option.value)}
                      >
                        <div className="score-number">{option.display}</div>
                        <div className="score-name">{scoreName}</div>
                      </button>
                    );
                  });
                })()}
              </div>
              {scores[editingScoreCell.playerId]?.[editingScoreCell.holeNumber] && (
                <button
                  className="score-modal-delete"
                  onClick={() => handleScoreSelect(null)}
                >
                  ลบสกอร์
                </button>
              )}
              <button
                className="score-modal-cancel"
                onClick={() => setEditingScoreCell(null)}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}
      </div>

      <div className="scorecard-container">
        <div className="scorecard-scroll">
          {/* First Nine (Front or Back depending on toggle) */}
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
                          fontSize: "0.875rem",
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
              {course.holes.slice(showBackNineFirst ? 9 : 0, showBackNineFirst ? 18 : 9).map((hole, idx) => (
                <tr key={idx} className={turboValues[hole.hole] > 1 ? 'turbo-row' : ''}>
                  <td 
                    className="hole-par-col-vertical"
                    onClick={() => handleOpenAnimalModal(hole.hole)}
                    style={{ 
                      position: 'relative', 
                      userSelect: 'none',
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      cursor: 'pointer'
                    }}
                    title="Click to add animal scores"
                  >
                    <div className="hole-par-combined">
                      <div 
                        className="hole-number-vertical"
                      >
                        {hole.hole}
                        {turboValues[hole.hole] > 1 && <span className="turbo-badge">x{turboValues[hole.hole]}</span>}
                      </div>
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
                          {/* H2H Indicator (top-left) - show on opponent columns */}
                          {index > 0 && sortedPlayers.length > 1 && (() => {
                            const viewPlayer = sortedPlayers[0];
                            const delta = getH2HIndicator(viewPlayer.id, player.id, hole.hole);
                            if (!delta || delta === 0) return null;
                            
                            const absValue = Math.abs(delta);
                            const symbol = delta > 0 ? "+" : "-";
                            const displayText = absValue >= 2 ? `${symbol}${absValue}` : symbol.repeat(absValue);
                            
                            return (
                              <div 
                                className="h2h-indicator"
                                style={{
                                  position: 'absolute',
                                  top: '2px',
                                  left: '2px',
                                  fontSize: absValue === 1 ? "1.1rem" : "0.875rem",
                                  fontWeight: 'bold',
                                  zIndex: 10,
                                  lineHeight: 1,
                                  pointerEvents: 'none',
                                  color: delta > 0 ? "#4caf50" : "#f44336"
                                }}
                              >
                                {displayText}
                              </div>
                            );
                          })()}
                          {/* Numeric handicap indicator (top-right) */}
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
                          {/* Animal indicator (bottom-left) */}
                          {(() => {
                            const animalIndicator = getAnimalIndicator(player.id, hole.hole);
                            if (!animalIndicator) return null;
                            
                            return (
                              <div 
                                className="animal-indicator"
                                style={{
                                  position: 'absolute',
                                  bottom: '2px',
                                  left: '2px',
                                  fontSize: '0.75rem',
                                  fontWeight: 'bold',
                                  color: '#ff9800',
                                  zIndex: 2,
                                  lineHeight: 1,
                                  pointerEvents: 'none'
                                }}
                              >
                                {animalIndicator.display}
                              </div>
                            );
                          })()}
                          {scores[player.id]?.[hole.hole] ? (
                            <div 
                              className={`score-display ${getScoreClass(scores[player.id][hole.hole], hole.par)}`}
                              onClick={() => canEditScore(player.id) && setEditingScoreCell({playerId: player.id, holeNumber: hole.hole})}
                              style={{cursor: canEditScore(player.id) ? 'pointer' : 'default', opacity: canEditScore(player.id) ? 1 : 0.7}}
                            >
                              {scores[player.id][hole.hole]}
                            </div>
                          ) : canEditScore(player.id) ? (
                            <div 
                              className="score-select"
                              onClick={() => setEditingScoreCell({playerId: player.id, holeNumber: hole.hole})}
                              style={{cursor: 'pointer'}}
                            >
                              -
                            </div>
                          ) : (
                            <div style={{fontSize: '1rem', color: '#999', textAlign: 'center', width: '100%'}}>-</div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* First Nine Total - Gross Score with O/U Par */}
              <tr className="total-row">
                <td className="hole-par-col-vertical"><strong>{showBackNineFirst ? '10-18' : '1-9'}</strong></td>
                {sortedPlayers.map((player, index) => {
                  const scoreTotal = calculateFirstNine(player.id);
                  
                  // Calculate Over/Under Par
                  let overUnderPar = 0;
                  let completedHoles = 0;
                  course.holes.slice(showBackNineFirst ? 9 : 0, showBackNineFirst ? 18 : 9).forEach(hole => {
                    const score = scores[player.id]?.[hole.hole];
                    if (score && score > 0) {
                      overUnderPar += (score - hole.par);
                      completedHoles++;
                    }
                  });
                  
                  let parText = '';
                  if (completedHoles > 0) {
                    if (overUnderPar > 0) {
                      parText = ` (+${overUnderPar})`;
                    } else if (overUnderPar < 0) {
                      parText = ` (${overUnderPar})`;
                    } else {
                      parText = ' (E)';
                    }
                  }
                  
                  return (
                    <td key={player.id} className={`total-cell ${index === 0 ? 'focus-player' : ''}`}>
                      <div style={{fontSize: '0.75rem', marginBottom: '2px'}}>{player.username}</div>
                      <div>
                        <strong>{scoreTotal}</strong>
                        {parText && (
                          <span style={{
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            color: overUnderPar > 0 ? '#f44336' : overUnderPar < 0 ? '#4caf50' : '#666',
                            marginLeft: '4px'
                          }}>
                            {parText}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
              {/* First Nine - H2H Score */}
              <tr className="total-row h2h-total-row">
                <td className="hole-par-col-vertical" style={{ fontSize: '0.85rem' }}>
                  <div>H2H</div>
                </td>
                {sortedPlayers.map((player, index) => {
                  let h2hText = '';
                  if (index > 0 && sortedPlayers.length > 1) {
                    const viewPlayer = sortedPlayers[0];
                    const h2hTotal = getH2HTotalForHoles(viewPlayer.id, player.id, showBackNineFirst ? 10 : 1, showBackNineFirst ? 18 : 9);
                    if (h2hTotal !== 0) {
                      const sign = h2hTotal > 0 ? '+' : '';
                      h2hText = `${sign}${h2hTotal}`;
                    }
                  }
                  
                  return (
                    <td key={player.id} className={`total-cell ${index === 0 ? 'focus-player' : ''}`}>
                      {h2hText && (
                        <span style={{
                          fontSize: '1rem',
                          fontWeight: 'bold',
                          color: h2hText.startsWith('+') ? '#4caf50' : '#f44336'
                        }}>
                          {h2hText}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
              {/* First Nine - Animal Score */}
              <tr className="total-row animal-total-row">
                <td className="hole-par-col-vertical" style={{ fontSize: '0.85rem' }}>
                  <div>Animal</div>
                </td>
                {sortedPlayers.map((player, index) => {
                  const animalCalculated = calculateAnimalScores(animalScores, players, turboValues);
                  const playerAnimal = animalCalculated[player.id];
                  const animalTotal = playerAnimal ? (showBackNineFirst ? playerAnimal.totalBack9 : playerAnimal.totalFront9) : 0;
                  
                  return (
                    <td key={player.id} className={`total-cell ${index === 0 ? 'focus-player' : ''}`}>
                      {animalTotal > 0 && (
                        <span style={{
                          fontSize: '1rem',
                          fontWeight: 'bold',
                          color: '#ff6b6b'
                        }}>
                          {animalTotal}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>

          {/* Second Nine (Back or Front depending on toggle) */}
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
                          fontSize: "0.875rem",
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
              {course.holes.slice(showBackNineFirst ? 0 : 9, showBackNineFirst ? 9 : 18).map((hole, idx) => (
                <tr key={idx} className={turboValues[hole.hole] > 1 ? 'turbo-row' : ''}>
                  <td 
                    className="hole-par-col-vertical"
                    onClick={() => handleOpenAnimalModal(hole.hole)}
                    style={{ 
                      position: 'relative', 
                      userSelect: 'none',
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      cursor: 'pointer'
                    }}
                    title="Click to add animal scores"
                  >
                    <div className="hole-par-combined">
                      <div 
                        className="hole-number-vertical"
                      >
                        {hole.hole}
                        {turboValues[hole.hole] > 1 && <span className="turbo-badge">x{turboValues[hole.hole]}</span>}
                      </div>
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
                          {/* H2H Indicator (top-left) - show on opponent columns */}
                          {index > 0 && sortedPlayers.length > 1 && (() => {
                            const viewPlayer = sortedPlayers[0];
                            const delta = getH2HIndicator(viewPlayer.id, player.id, hole.hole);
                            if (!delta || delta === 0) return null;
                            
                            const absValue = Math.abs(delta);
                            const symbol = delta > 0 ? "+" : "-";
                            const displayText = absValue >= 2 ? `${symbol}${absValue}` : symbol.repeat(absValue);
                            
                            return (
                              <div 
                                className="h2h-indicator"
                                style={{
                                  position: 'absolute',
                                  top: '2px',
                                  left: '2px',
                                  fontSize: absValue === 1 ? "1.1rem" : "0.875rem",
                                  fontWeight: 'bold',
                                  zIndex: 10,
                                  lineHeight: 1,
                                  pointerEvents: 'none',
                                  color: delta > 0 ? "#4caf50" : "#f44336"
                                }}
                              >
                                {displayText}
                              </div>
                            );
                          })()}
                          {/* Numeric handicap indicator (top-right) */}
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
                          {/* Animal indicator (bottom-left) */}
                          {(() => {
                            const animalIndicator = getAnimalIndicator(player.id, hole.hole);
                            if (!animalIndicator) return null;
                            
                            return (
                              <div 
                                className="animal-indicator"
                                style={{
                                  position: 'absolute',
                                  bottom: '2px',
                                  left: '2px',
                                  fontSize: '0.75rem',
                                  fontWeight: 'bold',
                                  color: '#ff9800',
                                  zIndex: 2,
                                  lineHeight: 1,
                                  pointerEvents: 'none'
                                }}
                              >
                                {animalIndicator.display}
                              </div>
                            );
                          })()}
                          {scores[player.id]?.[hole.hole] ? (
                            <div 
                              className={`score-display ${getScoreClass(scores[player.id][hole.hole], hole.par)}`}
                              onClick={() => canEditScore(player.id) && setEditingScoreCell({playerId: player.id, holeNumber: hole.hole})}
                              style={{cursor: canEditScore(player.id) ? 'pointer' : 'default', opacity: canEditScore(player.id) ? 1 : 0.7}}
                            >
                              {scores[player.id][hole.hole]}
                            </div>
                          ) : canEditScore(player.id) ? (
                            <div 
                              className="score-select"
                              onClick={() => setEditingScoreCell({playerId: player.id, holeNumber: hole.hole})}
                              style={{cursor: 'pointer'}}
                            >
                              -
                            </div>
                          ) : (
                            <div style={{fontSize: '1rem', color: '#999', textAlign: 'center', width: '100%'}}>-</div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Second Nine Total - Gross Score with O/U Par */}
              <tr className="total-row">
                <td className="hole-par-col-vertical"><strong>{showBackNineFirst ? '1-9' : '10-18'}</strong></td>
                {sortedPlayers.map((player, index) => {
                  const scoreTotal = calculateSecondNine(player.id);
                  
                  // Calculate Over/Under Par
                  let overUnderPar = 0;
                  let completedHoles = 0;
                  course.holes.slice(showBackNineFirst ? 0 : 9, showBackNineFirst ? 9 : 18).forEach(hole => {
                    const score = scores[player.id]?.[hole.hole];
                    if (score && score > 0) {
                      overUnderPar += (score - hole.par);
                      completedHoles++;
                    }
                  });
                  
                  let parText = '';
                  if (completedHoles > 0) {
                    if (overUnderPar > 0) {
                      parText = ` (+${overUnderPar})`;
                    } else if (overUnderPar < 0) {
                      parText = ` (${overUnderPar})`;
                    } else {
                      parText = ' (E)';
                    }
                  }
                  
                  return (
                    <td key={player.id} className={`total-cell ${index === 0 ? 'focus-player' : ''}`}>
                      <div style={{fontSize: '0.75rem', marginBottom: '2px'}}>{player.username}</div>
                      <div>
                        <strong>{scoreTotal}</strong>
                        {parText && (
                          <span style={{
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            color: overUnderPar > 0 ? '#f44336' : overUnderPar < 0 ? '#4caf50' : '#666',
                            marginLeft: '4px'
                          }}>
                            {parText}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
              {/* Second Nine - H2H Score */}
              <tr className="total-row h2h-total-row">
                <td className="hole-par-col-vertical" style={{ fontSize: '0.85rem' }}>
                  <div>H2H</div>
                </td>
                {sortedPlayers.map((player, index) => {
                  let h2hText = '';
                  if (index > 0 && sortedPlayers.length > 1) {
                    const viewPlayer = sortedPlayers[0];
                    const h2hTotal = getH2HTotalForHoles(viewPlayer.id, player.id, showBackNineFirst ? 1 : 10, showBackNineFirst ? 9 : 18);
                    if (h2hTotal !== 0) {
                      const sign = h2hTotal > 0 ? '+' : '';
                      h2hText = `${sign}${h2hTotal}`;
                    }
                  }
                  
                  return (
                    <td key={player.id} className={`total-cell ${index === 0 ? 'focus-player' : ''}`}>
                      {h2hText && (
                        <span style={{
                          fontSize: '1rem',
                          fontWeight: 'bold',
                          color: h2hText.startsWith('+') ? '#4caf50' : '#f44336'
                        }}>
                          {h2hText}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
              {/* Second Nine - Animal Score */}
              <tr className="total-row animal-total-row">
                <td className="hole-par-col-vertical" style={{ fontSize: '0.85rem' }}>
                  <div>Animal</div>
                </td>
                {sortedPlayers.map((player, index) => {
                  const animalCalculated = calculateAnimalScores(animalScores, players, turboValues);
                  const playerAnimal = animalCalculated[player.id];
                  const animalTotal = playerAnimal ? (showBackNineFirst ? playerAnimal.totalFront9 : playerAnimal.totalBack9) : 0;
                  
                  return (
                    <td key={player.id} className={`total-cell ${index === 0 ? 'focus-player' : ''}`}>
                      {animalTotal > 0 && (
                        <span style={{
                          fontSize: '1rem',
                          fontWeight: 'bold',
                          color: '#ff6b6b'
                        }}>
                          {animalTotal}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
              {/* Grand Total - Gross Score with O/U Par */}
              <tr className="total-row final-row">
                <td className="hole-par-col-vertical"><strong>Total</strong></td>
                {sortedPlayers.map((player, index) => {
                  const scoreTotal = calculateTotal(player.id);
                  
                  // Calculate Over/Under Par
                  let overUnderPar = 0;
                  let completedHoles = 0;
                  course.holes.forEach(hole => {
                    const score = scores[player.id]?.[hole.hole];
                    if (score && score > 0) {
                      overUnderPar += (score - hole.par);
                      completedHoles++;
                    }
                  });
                  
                  let parText = '';
                  if (completedHoles > 0) {
                    if (overUnderPar > 0) {
                      parText = ` (+${overUnderPar})`;
                    } else if (overUnderPar < 0) {
                      parText = ` (${overUnderPar})`;
                    } else {
                      parText = ' (E)';
                    }
                  }
                  
                  return (
                    <td key={player.id} className={`total-cell final ${index === 0 ? 'focus-player' : ''}`}>
                      <div style={{fontSize: '0.8rem', fontWeight: '600', marginBottom: '2px'}}>{player.username}</div>
                      <div>
                        <strong>{scoreTotal}</strong>
                        {parText && (
                          <span style={{
                            fontSize: '0.9rem',
                            fontWeight: 'bold',
                            color: overUnderPar > 0 ? '#f44336' : overUnderPar < 0 ? '#4caf50' : '#666',
                            marginLeft: '4px'
                          }}>
                            {parText}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
              {/* Grand Total - H2H Score */}
              <tr className="total-row h2h-total-row h2h-grand-total">
                <td className="hole-par-col-vertical" style={{ fontSize: '0.9rem' }}>
                  <div style={{lineHeight: '1.2'}}>
                    <div>H2H</div>
                    <div>Total</div>
                  </div>
                </td>
                {sortedPlayers.map((player, index) => {
                  let h2hText = '';
                  if (index > 0 && sortedPlayers.length > 1) {
                    const viewPlayer = sortedPlayers[0];
                    const h2hTotal = getH2HTotalForHoles(viewPlayer.id, player.id, 1, 18);
                    if (h2hTotal !== 0) {
                      const sign = h2hTotal > 0 ? '+' : '';
                      h2hText = `${sign}${h2hTotal}`;
                    }
                  }
                  
                  return (
                    <td key={player.id} className={`total-cell ${index === 0 ? 'focus-player' : ''}`}>
                      {h2hText && (
                        <span style={{
                          fontSize: '1.2rem',
                          fontWeight: '700',
                          color: h2hText.startsWith('+') ? '#4caf50' : '#f44336'
                        }}>
                          {h2hText}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
              {/* Grand Total - Animal Score */}
              <tr className="total-row animal-total-row animal-grand-total">
                <td className="hole-par-col-vertical" style={{ fontSize: '0.9rem' }}>
                  <div style={{lineHeight: '1.2'}}>
                    <div>Animal</div>
                    <div>Total</div>
                  </div>
                </td>
                {sortedPlayers.map((player, index) => {
                  const animalCalculated = calculateAnimalScores(animalScores, players, turboValues);
                  const playerAnimal = animalCalculated[player.id];
                  const animalTotal = playerAnimal ? playerAnimal.grandTotal : 0;
                  
                  return (
                    <td key={player.id} className={`total-cell ${index === 0 ? 'focus-player' : ''}`}>
                      {animalTotal > 0 && (
                        <span style={{
                          fontSize: '1.2rem',
                          fontWeight: '700',
                          color: '#ff9800'
                        }}>
                          {animalTotal}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals with Suspense for lazy loading */}
      <Suspense fallback={<div />}>
        {/* Scoring Config Modal */}
        <ScoringConfigModal
          isOpen={showScoringConfigModal}
          onClose={() => setShowScoringConfigModal(false)}
          currentConfig={scoringConfig}
          onSave={handleSaveScoringConfig}
          isReadOnly={!isHost}
        />

        {/* Turbo Config Modal */}
        <TurboConfigModal
          isOpen={showTurboConfigModal}
          onClose={() => setShowTurboConfigModal(false)}
          currentTurboValues={turboValues}
          onSave={handleSaveTurboConfig}
          isReadOnly={!isHost}
        />
      </Suspense>

      {/* Animal Input Modal */}
      <Suspense fallback={<div>Loading...</div>}>
        <AnimalInputModal
          isOpen={showAnimalModal}
          onClose={() => setShowAnimalModal(false)}
          holeNumber={selectedAnimalHole}
          players={sortedPlayers}
          currentAnimalScores={animalScores}
          onSave={handleSaveAnimalScores}
        />
      </Suspense>

      {/* Animal Summary Modal */}
      {showAnimalSummary && (
        <Suspense fallback={<div>Loading...</div>}>
          <AnimalSummaryModal
            players={sortedPlayers}
            animalScores={animalScores}
            turboValues={turboValues}
            onClose={() => setShowAnimalSummary(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

export default GamePlay;
