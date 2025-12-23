import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import Home from './pages/Home';
import CreateGame from './pages/CreateGame';
import JoinGame from './pages/JoinGame';
import GamePlay from './pages/GamePlay';
import VersionInfo from './components/VersionInfo';

function App() {
  return (
    <Router>
      <SocketProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreateGame />} />
          <Route path="/join" element={<JoinGame />} />
          <Route path="/game/:gameId" element={<GamePlay />} />
        </Routes>
        <VersionInfo />
      </SocketProvider>
    </Router>
  );
}

export default App;
