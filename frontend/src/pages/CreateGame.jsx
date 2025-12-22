import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './CreateGame.css';

const CreateGame = () => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const response = await api.get('/games/courses');
      setCourses(response.data.courses);
      if (response.data.courses.length > 0) {
        setSelectedCourse(response.data.courses[0].id);
      }
    } catch (err) {
      console.error('Failed to load courses:', err);
      setError('Failed to load courses');
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleCreateGame = async () => {
    if (!selectedCourse) {
      setError('Please select a course');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await api.post('/games', { courseId: selectedCourse });
      const { game, hostPin, guestPin } = response.data;
      
      // Navigate to game with PINs
      navigate(`/game/${game.id}`, { 
        state: { hostPin, guestPin, showPins: true } 
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create game');
    } finally {
      setLoading(false);
    }
  };

  if (loadingCourses) {
    return (
      <div className="page">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Back
        </button>

        <div className="card create-game-card">
          <h2>Create New Game</h2>
          <p className="description">
            Select a course and create a game. You'll receive two PINs to share with players.
          </p>

          {error && <div className="error">{error}</div>}

          <div className="form-group">
            <label htmlFor="course">Select Course</label>
            <select
              id="course"
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              disabled={loading}
              className="course-select"
            >
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.name} ({course.holes} holes, Par {course.par_total})
                </option>
              ))}
            </select>
          </div>

          <button
            className="primary large-button"
            onClick={handleCreateGame}
            disabled={loading || !selectedCourse}
          >
            {loading ? 'Creating...' : '🏌️ Create Game as HOST'}
          </button>

          <div className="info-box">
            <p><strong>As HOST, you will:</strong></p>
            <ul>
              <li>Manage game participants</li>
              <li>Assign roles (CO-HOST or GUEST)</li>
              <li>Receive PINs to share with players</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateGame;
