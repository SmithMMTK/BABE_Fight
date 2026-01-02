import { useState, useEffect } from 'react';
import './AnimalInputModal.css';

const ANIMAL_TYPES = [
  { type: 'monkey', emoji: '🐒', name: 'Monkey', nameTH: 'ลิง' },
  { type: 'giraffe', emoji: '🦒', name: 'Giraffe', nameTH: 'ยีราฟ' },
  { type: 'snake', emoji: '🐍', name: 'Snake', nameTH: 'งู' },
  { type: 'camel', emoji: '🐪', name: 'Camel', nameTH: 'อูฐ' },
  { type: 'frog', emoji: '🐸', name: 'Frog', nameTH: 'กบ' },
  { type: 'monitor_lizard', emoji: '🐊', name: 'Monitor Lizard', nameTH: 'ตะกวด' }
];

function AnimalInputModal({ 
  isOpen, 
  onClose, 
  holeNumber, 
  players, 
  currentAnimalScores,
  onSave 
}) {
  // Initialize animal counts for each player
  const [animalCounts, setAnimalCounts] = useState({});

  const [showNumberPicker, setShowNumberPicker] = useState(null); // {playerId, animalType, currentValue}

  // Reset state when modal opens or currentAnimalScores changes
  useEffect(() => {
    if (isOpen) {
      const initial = {};
      players.forEach(player => {
        initial[player.id] = {};
        ANIMAL_TYPES.forEach(animal => {
          const existing = currentAnimalScores.find(
            score => score.player_id === player.id && 
                     score.hole_number === holeNumber && 
                     score.animal_type === animal.type
          );
          initial[player.id][animal.type] = existing ? existing.count : 0;
        });
      });
      setAnimalCounts(initial);
    }
  }, [isOpen, holeNumber, currentAnimalScores, players]);

  if (!isOpen) return null;

  const handleNumberSelect = (value) => {
    if (!showNumberPicker) return;
    const { playerId, animalType } = showNumberPicker;
    setAnimalCounts(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [animalType]: value
      }
    }));
    setShowNumberPicker(null);
  };

  const handleSave = () => {
    onSave(holeNumber, animalCounts);
    onClose();
  };

  const handleOverlayClick = (e) => {
    // Only close if clicked directly on overlay, not on content
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="animal-modal-overlay" onClick={handleOverlayClick}>
      <div 
        className="animal-modal-content"
      >
        <div className="animal-modal-header">
          <h2>Animal Scores - Hole {holeNumber}</h2>
          <button className="btn-close-animal" onClick={onClose}>✕</button>
        </div>

        <div className="animal-modal-body">
          <div className="animal-grid">
            {/* Header Row - Player Names */}
            <div className="animal-grid-header">
              <div className="animal-type-header">Animal</div>
              {players.map(player => (
                <div key={player.id} className="player-header">
                  {player.username}
                </div>
              ))}
            </div>

            {/* Animal Type Rows */}
            {ANIMAL_TYPES.map(animal => (
              <div key={animal.type} className="animal-row">
                <div className="animal-type-cell">
                  <span className="animal-emoji-large">{animal.emoji}</span>
                </div>
                
                {players.map(player => {
                  const count = animalCounts[player.id]?.[animal.type] ?? 0;
                  return (
                    <div key={player.id} className="animal-count-cell">
                      <div 
                        className="animal-count-display"
                        onClick={() => setShowNumberPicker({ 
                          playerId: player.id, 
                          animalType: animal.type,
                          currentValue: count
                        })}
                      >
                        {count}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="animal-modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="btn-save" onClick={handleSave}>
            บันทึก
          </button>
        </div>
      </div>

      {/* Number Picker Modal */}
      {showNumberPicker && (
        <div className="animal-number-picker-overlay" onClick={() => setShowNumberPicker(null)}>
          <div className="animal-number-picker-content" onClick={(e) => e.stopPropagation()}>
            <div className="animal-number-picker-header">
              <h3>Select Count</h3>
            </div>
            <div className="animal-number-picker-grid">
              {Array.from({ length: 11 }, (_, i) => i).map(num => (
                <button
                  key={num}
                  className={`animal-number-option ${showNumberPicker.currentValue === num ? 'selected' : ''}`}
                  onClick={() => handleNumberSelect(num)}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnimalInputModal;
