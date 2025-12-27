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
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

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

  // Filter courses based on search term
  const filteredCourses = courses.filter(course => 
    course.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCourseSelect = (course) => {
    setFormData({
      ...formData,
      courseId: course.id,
      courseName: course.name
    });
    setSearchTerm(course.name);
    setShowDropdown(false);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setShowDropdown(true);
    // Clear selection if user is typing
    if (formData.courseId && e.target.value !== formData.courseName) {
      setFormData({...formData, courseId: '', courseName: ''});
    }
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
            <div className="form-group course-search">
              <label className="form-label">เลือกสนามกอล์ฟ</label>
              <input
                type="text"
                className="form-control"
                placeholder="ค้นหาสนาม..."
                value={searchTerm}
                onChange={handleSearchChange}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                required
              />
              {showDropdown && filteredCourses.length > 0 && (
                <ul className="course-dropdown">
                  {filteredCourses.map(course => (
                    <li
                      key={course.id}
                      onClick={() => handleCourseSelect(course)}
                      className={formData.courseId === course.id ? 'selected' : ''}
                    >
                      {course.name} ({course.holes.length} หลุม)
                    </li>
                  ))}
                </ul>
              )}
              {showDropdown && searchTerm && filteredCourses.length === 0 && (
                <div className="no-results">ไม่พบสนามที่ค้นหา</div>
              )}
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
