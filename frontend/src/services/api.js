import axios from 'axios';

// Use dynamic host based on where the frontend is accessed from
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // For production (Azure Container Apps), use same origin
  // For local dev, check if running on localhost with port
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = isLocalDev ? ':8080' : '';
  return `${protocol}//${hostname}${port}/api`;
};

const API_URL = getApiUrl();

// Cache for handicap matrix (reduces repeated API calls)
let handicapMatrixCache = new Map();

const getCachedHandicapMatrix = async (gameId) => {
  if (handicapMatrixCache.has(gameId)) {
    return handicapMatrixCache.get(gameId);
  }
  const response = await axios.get(`${API_URL}/games/${gameId}/handicap-matrix`);
  handicapMatrixCache.set(gameId, response);
  return response;
};

const clearHandicapMatrixCache = (gameId) => {
  if (gameId) {
    handicapMatrixCache.delete(gameId);
  } else {
    handicapMatrixCache.clear();
  }
};

export const api = {
  // Games
  createGame: (data) => axios.post(`${API_URL}/games/create`, data),
  joinGame: (data) => axios.post(`${API_URL}/games/join`, data),
  getGame: (gameId) => axios.get(`${API_URL}/games/${gameId}`),
  getCourses: () => axios.get(`${API_URL}/games/courses/list`),

  // Players
  addPlayer: (gameId, data) => axios.post(`${API_URL}/games/${gameId}/players`, data),
  removePlayer: (gameId, playerId) => axios.delete(`${API_URL}/games/${gameId}/players/${playerId}`),
  togglePlayerRole: (gameId, playerId, data) => axios.patch(`${API_URL}/games/${gameId}/players/${playerId}/role`, data),
  updatePlayerUsername: (gameId, playerId, data) => axios.patch(`${API_URL}/games/${gameId}/players/${playerId}/username`, data),

  // Scores
  updateScore: (data) => axios.post(`${API_URL}/scores`, data),
  getPlayerScores: (playerId) => axios.get(`${API_URL}/scores/player/${playerId}`),
  getGameScores: (gameId) => axios.get(`${API_URL}/scores/game/${gameId}`),

  // Turbo
  getTurboValues: (gameId) => axios.get(`${API_URL}/games/${gameId}/turbo`),
  updateTurboValue: (gameId, data) => axios.post(`${API_URL}/games/${gameId}/turbo`, data),
  
  // Handicap (with caching)
  getHandicapMatrix: (gameId) => getCachedHandicapMatrix(gameId),
  updateHandicapMatrix: (gameId, matrix) => {
    clearHandicapMatrixCache(gameId);
    return axios.post(`${API_URL}/games/${gameId}/handicap-matrix`, { handicapMatrix: matrix });
  },
  updatePlayerHandicap: (gameId, playerId, handicap) => {
    clearHandicapMatrixCache(gameId);
    return axios.post(`${API_URL}/games/${gameId}/players/${playerId}/handicap`, { handicap });
  },
  
  // Scoring Configuration
  getScoringConfig: (gameId) => axios.get(`${API_URL}/games/${gameId}/scoring-config`),
  updateScoringConfig: (gameId, config, playerId) => axios.put(`${API_URL}/games/${gameId}/scoring-config`, { ...config, playerId }),
  
  // Version
  getVersion: () => axios.get(`${API_URL}/version`)
};
