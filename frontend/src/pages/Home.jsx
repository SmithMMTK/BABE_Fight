import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { connected } = useSocket();

  // If user is already logged in, show their active games or allow them to create/join
  // Otherwise, show the two main choices
  const isLoggedIn = !!user;

  return (
    <div className="page home-page">
      <div className="home-container">
        <div className="golf-icon">⛳</div>
        <h1 className="home-title">BABE Fight</h1>
        <p className="home-subtitle">Golf Scorecard Tracker</p>
        
        {isLoggedIn && (
          <>
            <p className="welcome-text">Welcome, {user?.username}!</p>
            <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
              <span className="status-dot"></span>
              {connected ? 'Connected' : 'Disconnected'}
            </div>
          </>
        )}

        {!isLoggedIn && (
          <p className="tagline">Choose how you want to join the game:</p>
        )}

        <div className="choice-container">
          <div className="choice-card">
            <div className="choice-icon">👑</div>
            <h2>Join as HOST</h2>
            <p>Create a new game and invite players</p>
            <button 
              className="primary large-button" 
              onClick={() => navigate('/create')}
            >
              Start as Host
            </button>
          </div>

          <div className="choice-divider">OR</div>

          <div className="choice-card">
            <div className="choice-icon">🤝</div>
            <h2>Join as GUEST</h2>
            <p>Enter a PIN to join an existing game</p>
            <button 
              className="secondary large-button" 
              onClick={() => navigate('/join')}
            >
              Join with PIN
            </button>
          </div>
        </div>

        {isLoggedIn && (
          <button className="logout-button" onClick={logout}>
            Logout
          </button>
        )}
      </div>
    </div>
  );
};

export default Home;
