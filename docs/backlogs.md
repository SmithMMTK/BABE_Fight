# BABE Fight - Feature Backlogs

## Pending Features

### 🎯 Diagonal Strikethrough for H2H Score Display
**Status:** Ready to implement  
**Priority:** Medium  
**Use Case:** แสดงผลแพ้ชนะใน Head-to-Head scoring

#### Implementation Details

**CSS (GamePlay.css):**
```css
.score-par-strike {
  position: relative;
}

.score-par-strike::before {
  content: attr(data-score);
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  background-image: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 3px,
    currentColor 3px,
    currentColor 4px,
    transparent 4px,
    transparent 8px
  );
  pointer-events: none;
}
```

**JSX Usage (GamePlay.jsx):**
```jsx
// Add conditional class based on H2H result
className={`score-display ${getScoreClass(score, par)} ${shouldStrikethrough ? 'score-par-strike' : ''}`}
```

**Behavior:**
- เส้นขีดเฉียงจะซ้อนกันตามจำนวน score
- score = 4 → 4 เส้น
- score = 5 → 5 เส้น
- score = 6 → 6 เส้น

**To Activate:**
1. เพิ่มเงื่อนไขการแสดงผลตาม H2H logic
2. เพิ่ม class `score-par-strike` ตามเงื่อนไข
3. CSS พร้อมใช้งานแล้ว

---

## Completed Features
- ✅ Azure SQL Database migration
- ✅ WebSocket real-time updates
- ✅ Turbo multiplier system
- ✅ Local dev with SQLite, Production with Azure SQL
