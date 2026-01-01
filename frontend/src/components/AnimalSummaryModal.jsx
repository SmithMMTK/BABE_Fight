import React from 'react';

const AnimalSummaryModal = ({ players, animalScores, turboValues, onClose }) => {
  // Debug logging
  console.log('AnimalSummaryModal Props:', {
    players: players,
    playersCount: players?.length,
    playerNames: players?.map(p => ({ id: p.id, name: p.username })),
    animalScores: animalScores,
    animalScoresCount: animalScores?.length,
    turboValues: turboValues
  });

  const animalTypes = [
    { type: 'monkey', label: 'Monkey', emoji: '🐒' },
    { type: 'giraffe', label: 'Giraffe', emoji: '🦒' },
    { type: 'snake', label: 'Snake', emoji: '🐍' },
    { type: 'camel', label: 'Camel', emoji: '🐪' },
    { type: 'frog', label: 'Frog', emoji: '🐸' },
    { type: 'monitor_lizard', label: 'Monitor Lizard', emoji: '🐊' }
  ];

  // Calculate animal penalty for each player (count × turbo per animal type)
  const getPlayerAnimalCounts = (playerId) => {
    const counts = {};
    animalTypes.forEach(animal => {
      counts[animal.type] = 0;
    });

    // animalScores is a flat array of records
    // Each record is 1 animal, multiply by turbo
    if (Array.isArray(animalScores)) {
      animalScores.forEach(record => {
        if (record.player_id === playerId && record.animal_type && record.hole_number) {
          if (counts[record.animal_type] !== undefined) {
            const turbo = turboValues[record.hole_number] || 1;
            counts[record.animal_type] += turbo;
          }
        }
      });
    }

    return counts;
  };

  // Calculate total animals for each player
  const getPlayerTotalAnimals = (playerId) => {
    const counts = getPlayerAnimalCounts(playerId);
    return Object.values(counts).reduce((sum, count) => sum + count, 0);
  };

  // Calculate total penalty points for each player (with turbo)
  const getPlayerTotalPenalty = (playerId) => {
    let totalPenalty = 0;
    
    // animalScores is a flat array of records
    // Each record represents ONE animal at a specific hole
    if (Array.isArray(animalScores)) {
      animalScores.forEach(record => {
        if (record.player_id === playerId && record.hole_number) {
          const turbo = turboValues[record.hole_number] || 1;
          // Each record is 1 animal, so multiply by turbo value
          totalPenalty += 1 * turbo;
        }
      });
    }
    
    return totalPenalty;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000,
      padding: '10px'
    }} onClick={onClose}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        width: '100%',
        height: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden'
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '1px solid #e0e0e0'
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#333' }}>🐾 สรุป Animal Scores</h3>
          <button style={{
            background: 'none',
            border: 'none',
            fontSize: '1.3rem',
            cursor: 'pointer',
            color: '#666',
            padding: 0,
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%'
          }} onClick={onClose}>
            ✕
          </button>
        </div>
        
        <div style={{ padding: '8px 12px', overflowY: 'auto', flex: 1 }}>
          <div style={{ overflowX: 'auto', marginBottom: '8px', width: '100%' }}>
            <table style={{
              width: '100%',
              minWidth: '450px',
              borderCollapse: 'collapse',
              fontSize: '0.8rem',
              background: 'white',
              tableLayout: 'fixed'
            }}>
              <thead>
                <tr style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white'
                }}>
                  <th style={{
                    padding: '6px 6px',
                    textAlign: 'left',
                    fontWeight: 600,
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    fontSize: '0.8rem',
                    color: 'white',
                    whiteSpace: 'nowrap',
                    width: '120px',
                    minWidth: '120px',
                    paddingLeft: '8px'
                  }}>Animal Type</th>
                  {players.map(player => (
                    <th key={player.id} style={{
                      padding: '6px 4px',
                      textAlign: 'center',
                      fontWeight: 600,
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      fontSize: '0.8rem',
                      color: 'white',
                      whiteSpace: 'nowrap',
                      width: '75px',
                      minWidth: '75px'
                    }}>
                      {player.username}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {animalTypes.map(animal => (
                  <tr key={animal.type} style={{
                    borderBottom: '1px solid #e0e0e0'
                  }}>
                    <td style={{
                      padding: '5px 4px',
                      textAlign: 'left',
                      border: '1px solid #e0e0e0',
                      verticalAlign: 'middle',
                      paddingLeft: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '1px 0' }}>
                        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{animal.emoji}</span>
                        <span style={{ fontWeight: 500, fontSize: '0.8rem', color: '#333' }}>{animal.label}</span>
                      </div>
                    </td>
                    {players.map(player => {
                      const animalCounts = getPlayerAnimalCounts(player.id);
                      const count = animalCounts[animal.type];
                      
                      return (
                        <td key={player.id} style={{
                          padding: '5px 4px',
                          textAlign: 'center',
                          border: '1px solid #e0e0e0',
                          verticalAlign: 'middle'
                        }}>
                          {count > 0 ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              color: 'white',
                              padding: '3px 8px',
                              borderRadius: '10px',
                              fontWeight: 700,
                              minWidth: '24px',
                              fontSize: '0.8rem',
                              boxShadow: '0 1px 2px rgba(102, 126, 234, 0.3)'
                            }}>{count}</span>
                          ) : (
                            <span style={{ color: '#ccc', fontSize: '0.9rem', fontWeight: 300 }}>-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr style={{
                  borderTop: '3px solid #667eea',
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
                  fontWeight: 700,
                  fontSize: '1.05rem'
                }}>
                  <td style={{
                    padding: '6px 6px',
                    textAlign: 'left',
                    border: '1px solid #e0e0e0',
                    verticalAlign: 'middle',
                    paddingLeft: '8px'
                  }}>
                    <strong>Total</strong>
                  </td>
                  {players.map(player => {
                    const totalPenalty = getPlayerTotalPenalty(player.id);
                    
                    return (
                      <td key={player.id} style={{
                        padding: '6px 4px',
                        textAlign: 'center',
                        border: '1px solid #e0e0e0',
                        verticalAlign: 'middle',
                        background: 'rgba(255, 255, 255, 0.1)',
                        fontWeight: 'bold'
                      }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                          color: '#333',
                          padding: '3px 8px',
                          borderRadius: '10px',
                          fontWeight: 700,
                          minWidth: '28px',
                          fontSize: '0.85rem',
                          boxShadow: '0 1px 2px rgba(250, 112, 154, 0.3)'
                        }}>{totalPenalty > 0 ? `+${totalPenalty}` : '-'}</span>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          
          <div style={{
            background: '#f8f9fa',
            borderLeft: '3px solid #667eea',
            padding: '6px 10px',
            borderRadius: '3px',
            marginTop: '6px'
          }}>
            <p style={{ margin: 0, color: '#666', fontSize: '0.75rem', lineHeight: 1.3 }}>
              💡 คะแนนปรับคำนวณจากจำนวน Animal × ค่า Turbo ของแต่ละหลุม
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimalSummaryModal;
