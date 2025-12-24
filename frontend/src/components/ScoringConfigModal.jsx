import { useState, useEffect } from 'react';
import './ScoringConfigModal.css';

function ScoringConfigModal({ isOpen, onClose, currentConfig, onSave, isReadOnly = false }) {
  const [holeInOne, setHoleInOne] = useState(10);
  const [eagle, setEagle] = useState(5);
  const [birdie, setBirdie] = useState(2);
  const [parOrWorse, setParOrWorse] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (currentConfig) {
      setHoleInOne(currentConfig.holeInOne || 10);
      setEagle(currentConfig.eagle || 5);
      setBirdie(currentConfig.birdie || 2);
      setParOrWorse(currentConfig.parOrWorse || 1);
      setHasChanges(false); // Reset change tracking when config loads
    }
  }, [currentConfig]);

  // Track changes
  useEffect(() => {
    if (currentConfig) {
      const changed = 
        parseInt(holeInOne) !== (currentConfig.holeInOne || 10) ||
        parseInt(eagle) !== (currentConfig.eagle || 5) ||
        parseInt(birdie) !== (currentConfig.birdie || 2) ||
        parseInt(parOrWorse) !== (currentConfig.parOrWorse || 1);
      setHasChanges(changed);
    }
  }, [holeInOne, eagle, birdie, parOrWorse, currentConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        holeInOne: parseInt(holeInOne),
        eagle: parseInt(eagle),
        birdie: parseInt(birdie),
        parOrWorse: parseInt(parOrWorse)
      });
      setHasChanges(false);
      onClose();
    } catch (error) {
      console.error('Failed to save scoring config:', error);
      alert('ไม่สามารถบันทึกการตั้งค่าได้');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = async () => {
    // Auto-save if there are unsaved changes and not read-only
    if (hasChanges && !isReadOnly) {
      await handleSave();
    } else {
      onClose();
    }
  };

  const handleReset = () => {
    setHoleInOne(10);
    setEagle(5);
    setBirdie(2);
    setParOrWorse(1);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content scoring-config-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>H2H Scoring Configuration {isReadOnly && '(ดูอย่างเดียว)'}</h2>
          <button className="close-button" onClick={handleClose}>×</button>
        </div>
        
        <div className="modal-body">
          <p className="modal-description">
            {isReadOnly ? 'ค่าคะแนนปัจจุบันสำหรับการชนะแต่ละหลุม (เฉพาะ Host แก้ไขได้)' : 'กำหนดคะแนนที่ได้รับเมื่อชนะหลุม (Win by Score)'}
          </p>
          
          <div className="config-form">
            <div className="config-item">
              <label htmlFor="holeInOne">
                <span className="emoji">🎯</span>
                Hole-in-One
              </label>
              <input
                id="holeInOne"
                type="number"
                min="0"
                value={holeInOne}
                onChange={(e) => setHoleInOne(e.target.value)}
                disabled={isSaving || isReadOnly}
              />
              <span className="unit">คะแนน</span>
            </div>

            <div className="config-item">
              <label htmlFor="eagle">
                <span className="emoji">🦅</span>
                Eagle (-2)
              </label>
              <input
                id="eagle"
                type="number"
                min="0"
                value={eagle}
                onChange={(e) => setEagle(e.target.value)}
                disabled={isSaving || isReadOnly}
              />
              <span className="unit">คะแนน</span>
            </div>

            <div className="config-item">
              <label htmlFor="birdie">
                <span className="emoji">🐦</span>
                Birdie (-1)
              </label>
              <input
                id="birdie"
                type="number"
                min="0"
                value={birdie}
                onChange={(e) => setBirdie(e.target.value)}
                disabled={isSaving || isReadOnly}
              />
              <span className="unit">คะแนน</span>
            </div>

            <div className="config-item">
              <label htmlFor="parOrWorse">
                <span className="emoji">⛳</span>
                Par or Worse (0, +1, +2, ...)
              </label>
              <input
                id="parOrWorse"
                type="number"
                min="0"
                value={parOrWorse}
                onChange={(e) => setParOrWorse(e.target.value)}
                disabled={isSaving || isReadOnly}
              />
              <span className="unit">คะแนน</span>
            </div>
          </div>

          <div className="config-note">
            <strong>Note:</strong> คะแนนเหล่านี้จะถูกนำไปคูณกับตัวคูณ Turbo ของแต่ละหลุม
          </div>
        </div>

        <div className="modal-footer">
          {!isReadOnly ? (
            <>
              <button 
                className="button-secondary" 
                onClick={handleReset}
                disabled={isSaving}
              >
                รีเซ็ตค่าเริ่มต้น
              </button>
              <div className="footer-right">
                <button 
                  className="button-secondary" 
                  onClick={handleClose}
                  disabled={isSaving}
                >
                  {hasChanges ? 'บันทึกและปิด' : 'ปิด'}
                </button>
                {hasChanges && (
                  <button 
                    className="button-primary" 
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? 'กำลังบันทึก...' : 'บันทึกทันที'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <button 
              className="button-primary" 
              onClick={handleClose}
              style={{ marginLeft: 'auto' }}
            >
              ปิด
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScoringConfigModal;
