import { useState, useEffect } from 'react';
import './TurboConfigModal.css';

function TurboConfigModal({ isOpen, onClose, currentTurboValues, onSave, isReadOnly = false }) {
  const [selectedPreset, setSelectedPreset] = useState('custom');
  const [customValues, setCustomValues] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Preset configurations
  const presets = {
    standard: {
      name: 'Standard Turbo 9, 18 (x2)',
      values: { 9: 2, 18: 2 }
    },
    curve: {
      name: 'โค้งมรณะ',
      values: { 7: 2, 8: 3, 9: 4, 16: 2, 17: 3, 18: 4 }
    },
    multiplier: {
      name: 'หลุมคูณ (ค่า default)',
      values: { 1: 2, 7: 2, 8: 2, 9: 3, 10: 2, 16: 2, 17: 2, 18: 3 }
    }
  };

  useEffect(() => {
    if (currentTurboValues) {
      setCustomValues(currentTurboValues);
      // Detect which preset is currently active
      detectPreset(currentTurboValues);
    }
  }, [currentTurboValues]);

  const detectPreset = (values) => {
    // Check if current values match any preset
    for (const [key, preset] of Object.entries(presets)) {
      const presetValues = preset.values;
      const allMatch = Object.keys(presetValues).every(
        hole => values[hole] === presetValues[hole]
      );
      const allOthersOne = Array.from({ length: 18 }, (_, i) => i + 1)
        .filter(h => !presetValues[h])
        .every(h => !values[h] || values[h] === 1);
      
      if (allMatch && allOthersOne) {
        setSelectedPreset(key);
        return;
      }
    }
    setSelectedPreset('custom');
  };

  const applyPreset = (presetKey) => {
    setSelectedPreset(presetKey);
    if (presetKey === 'custom') return;

    const preset = presets[presetKey];
    const newValues = {};
    // Set all holes to 1 first
    for (let i = 1; i <= 18; i++) {
      newValues[i] = 1;
    }
    // Apply preset values
    Object.entries(preset.values).forEach(([hole, multiplier]) => {
      newValues[hole] = multiplier;
    });
    setCustomValues(newValues);
  };

  const handleCustomChange = (hole, value) => {
    setSelectedPreset('custom');
    setCustomValues(prev => ({
      ...prev,
      [hole]: parseInt(value)
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(customValues);
      onClose();
    } catch (error) {
      console.error('Failed to save turbo config:', error);
      alert('ไม่สามารถบันทึกการตั้งค่าได้');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isReadOnly) {
      // Auto-save before closing
      handleSave();
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content turbo-config-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>กำหนดหลุมเทอร์โบ {isReadOnly && '(ดูอย่างเดียว)'}</h2>
          <button className="close-button" onClick={handleClose}>×</button>
        </div>
        
        <div className="modal-body">
          {!isReadOnly && (
            <div className="preset-section">
              <h3>เลือกแบบตั้งค่าสำเร็จ:</h3>
              <div className="preset-options">
                {Object.entries(presets).map(([key, preset]) => (
                  <button
                    key={key}
                    className={`preset-button ${selectedPreset === key ? 'selected' : ''}`}
                    onClick={() => applyPreset(key)}
                    disabled={isSaving}
                  >
                    {preset.name}
                  </button>
                ))}
                <button
                  className={`preset-button ${selectedPreset === 'custom' ? 'selected' : ''}`}
                  onClick={() => setSelectedPreset('custom')}
                  disabled={isSaving}
                >
                  กำหนดเอง
                </button>
              </div>
            </div>
          )}

          <div className="custom-section">
            <h3>{selectedPreset === 'custom' ? 'กำหนดค่าเอง:' : 'ค่าปัจจุบัน:'}</h3>
            
            <div className="holes-section">
              <h4>Front 9 (หลุม 1-9)</h4>
              <div className="holes-grid">
                {Array.from({ length: 9 }, (_, i) => i + 1).map(hole => (
                  <div key={hole} className="hole-config-item">
                    <label>หลุม {hole}</label>
                    <select
                      value={customValues[hole] || 1}
                      onChange={(e) => handleCustomChange(hole, e.target.value)}
                      disabled={isSaving || isReadOnly || selectedPreset !== 'custom'}
                      className={customValues[hole] > 1 ? 'turbo-active' : ''}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                        <option key={num} value={num}>x{num}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="holes-section">
              <h4>Back 9 (หลุม 10-18)</h4>
              <div className="holes-grid">
                {Array.from({ length: 9 }, (_, i) => i + 10).map(hole => (
                  <div key={hole} className="hole-config-item">
                    <label>หลุม {hole}</label>
                    <select
                      value={customValues[hole] || 1}
                      onChange={(e) => handleCustomChange(hole, e.target.value)}
                      disabled={isSaving || isReadOnly || selectedPreset !== 'custom'}
                      className={customValues[hole] > 1 ? 'turbo-active' : ''}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                        <option key={num} value={num}>x{num}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          {!isReadOnly ? (
            <button 
              onClick={handleSave} 
              className="btn btn-primary" 
              disabled={isSaving}
            >
              {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          ) : (
            <button onClick={onClose} className="btn btn-secondary">
              ปิด
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default TurboConfigModal;
