
# Commit Logs

## ✅ Validate existing player name before join game (Completed - Dec 23, 2025)
- **Security Feature**: Users must know BOTH PIN AND existing player's exact name to join
- Prevents unauthorized access even with correct PIN
- Returns 403 Forbidden if username doesn't match any existing player
- Frontend displays Thai error message: "ชื่อผู้เล่นไม่ตรงกับผู้เล่นที่มีอยู่ในเกม กรุณาระบุชื่อที่ถูกต้อง"
- Only allows rejoining with exact existing player names


## Add HC calculation between players

