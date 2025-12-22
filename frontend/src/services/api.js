import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

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
  getGameScores: (gameId) => axios.get(`${API_URL}/scores/game/${gameId}`)
};
