import { useState } from 'react';
import './PlayersMenu.css';

function PlayersMenu({ 
  players, 
  currentPlayerId,
  isHost, 
  hostPin, 
  guestPin,
  onAddPlayer,
  onRemovePlayer,
  onToggleRole,
  onUpdateUsername
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerRole, setNewPlayerRole] = useState('player');
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editUsername, setEditUsername] = useState('');

  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const isCurrentPlayerHost = currentPlayer?.role === 'host';

  console.log('PlayersMenu Debug:', { currentPlayerId, players, currentPlayer });

  const handleAddPlayer = () => {
    if (!newPlayerName.trim()) return;
    onAddPlayer(newPlayerName, newPlayerRole);
    setNewPlayerName('');
    setNewPlayerRole('player');
  };

  const handleStartEdit = (player) => {
    setEditingPlayerId(player.id);
    setEditUsername(player.username);
  };

  const handleSaveEdit = (playerId) => {
    if (!editUsername.trim()) return;
    onUpdateUsername(playerId, editUsername);
    setEditingPlayerId(null);
  };

  const handleToggleRole = (player) => {
    // ข้อ 4: Host ต้องไม่ lock-out ตัวเอง
    if (player.id === currentPlayerId && player.role === 'host') {
      alert('คุณไม่สามารถเปลี่ยน Role ของตัวเองจาก Host ได้');
      return;
    }
    const newRole = player.role === 'host' ? 'player' : 'host';
    onToggleRole(player.id, newRole);
  };

  return (
    <div className="players-menu">
      <button 
        className="players-menu-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        👥 Players ({players.length})
      </button>

      {isOpen && (
        <div className="players-menu-dropdown">
          {/* ข้อ 2: แสดง PINs */}
          <div className="pins-section">
            <div className="pin-item">
              <span className="pin-label">HOST PIN:</span>
              <span className="pin-code">{hostPin}</span>
            </div>
            <div className="pin-item">
              <span className="pin-label">GUEST PIN:</span>
              <span className="pin-code">{guestPin}</span>
            </div>
          </div>

          {/* ข้อ 3: Host เพิ่ม player */}
          {isCurrentPlayerHost && (
            <div className="add-player-section">
              <h4>เพิ่มผู้เล่น</h4>
              <div className="add-player-form">
                <input
                  type="text"
                  placeholder="ชื่อผู้เล่น"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  className="player-input"
                />
                <select
                  value={newPlayerRole}
                  onChange={(e) => setNewPlayerRole(e.target.value)}
                  className="role-select"
                >
                  <option value="player">Guest</option>
                  <option value="host">Host</option>
                </select>
                <button onClick={handleAddPlayer} className="btn-add">
                  เพิ่ม
                </button>
              </div>
            </div>
          )}

          {/* Players List */}
          <div className="players-list">
            <h4>รายชื่อผู้เล่น</h4>
            {players.map(player => (
              <div key={player.id} className="player-item">
                <div className="player-main">
                  {editingPlayerId === player.id ? (
                    <div className="edit-username">
                      <input
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        className="edit-input"
                        autoFocus
                      />
                      <button 
                        onClick={() => handleSaveEdit(player.id)}
                        className="btn-save"
                      >
                        ✓
                      </button>
                      <button 
                        onClick={() => setEditingPlayerId(null)}
                        className="btn-cancel"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="player-info">
                        <span className="player-username">{player.username}</span>
                        <span className={`role-badge ${player.role}`}>
                          {player.role === 'host' ? 'HOST' : 'GUEST'}
                        </span>
                        {player.id === currentPlayerId && (
                          <span className="you-badge">(คุณ)</span>
                        )}
                      </div>

                      <div className="player-actions">
                        {/* HOST แก้ไขได้ทุกคน, GUEST แก้ไขได้เฉพาะตัวเอง */}
                        {(isCurrentPlayerHost || player.id === currentPlayerId) && (
                          <button
                            onClick={() => handleStartEdit(player)}
                            className="btn-edit"
                            title="แก้ไขชื่อ"
                          >
                            ✏️
                          </button>
                        )}

                        {/* HOST controls - Toggle และ Remove */}
                        {isCurrentPlayerHost && (
                          <>
                            {/* Toggle role - ไม่ toggle ตัวเอง */}
                            {player.id !== currentPlayerId && (
                              <button
                                onClick={() => handleToggleRole(player)}
                                className="btn-toggle"
                                title="เปลี่ยน Role"
                              >
                                🔄
                              </button>
                            )}
                            {/* Remove - ไม่ลบตัวเอง */}
                            {player.id !== currentPlayerId && (
                              <button
                                onClick={() => onRemovePlayer(player.id)}
                                className="btn-remove"
                                title="ลบผู้เล่น"
                              >
                                🗑️
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayersMenu;
