import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './JoinGame.css';

const JoinGame = () => {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleJoinGame = async (e) => {
    e.preventDefault();
    setError('');

    if (!pin) {
      setError('Please enter a PIN');
      return;
    }

    if (pin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/games/join', { pin });
      const { game, role } = response.data;
      navigate(`/game/${game.id}`, { state: { joinedRole: role } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join game');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="container">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Back
        </button>

        <div className="card join-game-card">
          <h2>Join Game</h2>
          <p className="description">
            Enter the 4-digit PIN shared by the HOST to join the game.
          </p>

          <form onSubmit={handleJoinGame}>
            {error && <div className="error">{error}</div>}

            <div className="form-group">
              <label htmlFor="pin">Game PIN</label>
              <input
                id="pin"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 4-digit PIN"
                maxLength="4"
                disabled={loading}
                className="pin-input"
              />
            </div>

            <button type="submit" className="primary large-button" disabled={loading || pin.length !== 4}>
              {loading ? 'Joining...' : '🤝 Join Game'}
            </button>
          </form>

          <div className="info-box">
            <p><strong>PIN Types:</strong></p>
            <ul>
              <li><strong>HOST PIN:</strong> Join as CO-HOST (full management access)</li>
              <li><strong>GUEST PIN:</strong> Join as GUEST (player only)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinGame;
