import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './JoinGame.css';

function JoinGame() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    pin: '',
    username: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.pin || !formData.username) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    if (formData.pin.length !== 4) {
      setError('PIN ต้องเป็นตัวเลข 4 หลัก');
      return;
    }

    try {
      const response = await api.joinGame(formData);
      const { gameId, role, hostPin, guestPin } = response.data;

      navigate(`/game/${gameId}`, {
        state: {
          isHost: role === 'host',
          hostPin,
          guestPin,
          username: formData.username
        }
      });
    } catch (err) {
      console.error('Failed to join game:', err);
      if (err.response?.status === 404) {
        setError('ไม่พบเกมที่ใช้ PIN นี้');
      } else if (err.response?.status === 403) {
        setError('ชื่อผู้เล่นไม่ตรงกับผู้เล่นที่มีอยู่ในเกม กรุณาระบุชื่อที่ถูกต้อง');
      } else {
        setError('ไม่สามารถเข้าร่วมเกมได้ กรุณาลองใหม่อีกครั้ง');
      }
    }
  };

  return (
    <div className="container">
      <div className="join-game-wrapper">
        <h1 className="text-center">เข้าร่วมเกม</h1>

        {error && <div className="error-message">{error}</div>}

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Game PIN (4 หลัก)</label>
              <input
                type="text"
                className="form-control"
                placeholder="0000"
                value={formData.pin}
                onChange={(e) => setFormData({...formData, pin: e.target.value.replace(/\D/g, '')})}
                maxLength={4}
                required
                inputMode="numeric"
                pattern="[0-9]{4}"
              />
            </div>

            <div className="form-group">
              <label className="form-label">ชื่อของคุณ</label>
              <input
                type="text"
                className="form-control"
                placeholder="ใส่ชื่อของคุณ"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                required
                maxLength={50}
              />
            </div>

            <button type="submit" className="btn btn-success btn-block">
              เข้าร่วมเกม
            </button>
          </form>
        </div>

        <div className="back-link">
          <button onClick={() => navigate('/')} className="btn btn-secondary btn-block">
            ← กลับหน้าหลัก
          </button>
        </div>
      </div>
    </div>
  );
}

export default JoinGame;
