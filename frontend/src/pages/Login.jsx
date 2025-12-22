import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!username || !pin) {
      setError('Username and PIN are required');
      return;
    }

    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    setLoading(true);

    try {
      await login(username, pin);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page login-page">
      <div className="login-container">
        <div className="golf-icon">⛳</div>
        <h1>BABE Fight</h1>
        <p className="subtitle">Golf Scorecard Tracker</p>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="pin">PIN</label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter your PIN"
              autoComplete="off"
              disabled={loading}
              maxLength="6"
            />
          </div>

          <button type="submit" className="primary login-button" disabled={loading}>
            {loading ? 'Logging in...' : 'Login / Sign Up'}
          </button>
        </form>

        <p className="info-text">
          Enter your username and PIN to login. <br />
          New users will be automatically registered.
        </p>
      </div>
    </div>
  );
};

export default Login;
