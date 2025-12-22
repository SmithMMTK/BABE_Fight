import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './CreateGame.css';

function CreateGame() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    courseId: '',
    courseName: '',
    hostUsername: ''
  });

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const response = await api.getCourses();
      setCourses(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load courses:', err);
      setError('ไม่สามารถโหลดรายการสนามได้ กรุณาลองใหม่อีกครั้ง');
      setLoading(false);
    }
  };

  const handleCourseChange = (e) => {
    const courseId = e.target.value;
    const course = courses.find(c => c.id === courseId);
    setFormData({
      ...formData,
      courseId,
      courseName: course ? course.name : ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.courseId || !formData.hostUsername) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      const response = await api.createGame(formData);
      const { gameId, hostPin, guestPin } = response.data;
      
      // Navigate to game with data
      navigate(`/game/${gameId}`, {
        state: {
          isHost: true,
          hostPin,
          guestPin,
          username: formData.hostUsername
        }
      });
    } catch (err) {
      console.error('Failed to create game:', err);
      setError('ไม่สามารถสร้างเกมได้ กรุณาลองใหม่อีกครั้ง');
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="create-game-wrapper">
        <h1 className="text-center">เริ่มเกมใหม่</h1>

        {error && <div className="error-message">{error}</div>}

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">เลือกสนามกอล์ฟ</label>
              <select
                className="form-select"
                value={formData.courseId}
                onChange={handleCourseChange}
                required
              >
                <option value="">-- เลือกสนาม --</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.name} ({course.holes.length} หลุม)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">ชื่อของคุณ</label>
              <input
                type="text"
                className="form-control"
                placeholder="ใส่ชื่อของคุณ"
                value={formData.hostUsername}
                onChange={(e) => setFormData({...formData, hostUsername: e.target.value})}
                required
                maxLength={50}
              />
            </div>

            <button type="submit" className="btn btn-success btn-block">
              สร้างเกม
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

export default CreateGame;
