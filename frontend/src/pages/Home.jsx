import { Link } from 'react-router-dom';
import './Home.css';

function Home() {
  return (
    <div className="container">
      <div className="home-wrapper">
        <h1 className="text-center">BABE Fight</h1>
        <p className="subtitle text-center">Golf Scorecard Tracker</p>

        <div className="choice-container">
          <Link to="/create" className="choice-card">
            <div className="choice-icon">🏌️</div>
            <h2>เริ่มเกมใหม่</h2>
            <p className="text-muted">สร้างเกมและรับ PIN สำหรับเชิญเพื่อน</p>
          </Link>

          <Link to="/join" className="choice-card">
            <div className="choice-icon">👥</div>
            <h2>เข้าร่วมเกม</h2>
            <p className="text-muted">ใส่ PIN เพื่อเข้าร่วมเกมที่มีอยู่</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Home;
