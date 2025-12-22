# Handicap Stroke Allocation Algorithm

## Input
- `handicapMatrix`: { fromPlayerId: { toPlayerId: strokes } }
- `courseHoles`: [{ hole, par, hc, turbo }]

## Rules
1. ไม่มีการต่อแต้มในหลุมที่ turbo > 1 (เรียกว่าหลุม Turbo)
2. แยก Front 9 (1-9) และ Back 9 (10-18) คำนวณแยกกัน โดยเด็ดขาดไม่มีการเชื่อมโยงใด ๆ
3. การแจกแต้มต่อระหว่าง Player:
   - การคำนวนจะเริ่มเฉพาะคู่ที่มีการให้แต้มต่อกัน เช่น Player A [ต่อให้ B, ต่อให้ C] ถ้าไม่มีแต้มต่อ ก็ให้ข้าม Logic การต่อแต้มไปเลย
   - การคำนวนจะมองในมุม Player A (ผู้เล่น) ที่มีค่าแต้มต่อติดมาใน Handicap Matrix
    
  ```json
       "handicapMatrix": {
      "lTJ-6H": {
        "0sftCh": 0,
        "Eem9Dd": 8,
        "6coyYp": 3,
        "-B0Y9a": 10
       }, ...
       }  
  ```

      แปลว่า Player A "lTJ-6H" ให้แต้มต่อ Eem9Dd 8 แต้ม "-", ถ้ามองในมุม Eem9Dd จะไม่เห็นแต้มต่อ แต่สามารถตรวจสอบได้ด้วยการ Loop check แต้มต่อโดยหาชื่อตัวเองจากผู้เล่นคนอื่น ในกรณีนี้ Eem9Dd จะมองเห็นว่า lTJ-6H ให้แต้มต่อตัวเอง 8 "+"

   - เรียง Par 4/5 ตาม HC น้อยไปมาก
   - เรียง Par 3 ต่อท้าย Par 4/5 ตาม HC น้อยไปมาก
   - เริ่มให้แต้มต่อหลุมละ 1 โดยหักจาก HC (แต้มต่อระหว่างบุคคล) ไปทีละ 1 จนครบหลุมที่ต่อ
   - ถ้าแต้มต่อยังเหลือ เช่น ต่อ 8 และมีหลุมปกติ (ไม่ Turbo) 5 หลุมซึ่งแจกแต้มต่อครบไปแล้ว จะเหลือ 3 ให้เอา 3 ที่เหลือไล่ทยอยใส่ไปในหลุม Par 4/5 ตาม HC น้อยไปมาก และถ้ายังไม่พอให้ใส่ไปในหลุม Par 3 ตาม HC แต่จะไม่มีการต่อเกินหลุมละ 2

 Possible scenario:
 
```json
  {
    "id": "st_andrew_2000",
    "name": "St. Andrew 2000",
    "holes": [
      { "hole": 1,  "par": 4, "hc": 9 },
      { "hole": 2,  "par": 4, "hc": 7 },
      { "hole": 3,  "par": 3, "hc": 1 },
      { "hole": 4,  "par": 6, "hc": 11 },
      { "hole": 5,  "par": 3, "hc": 13 },
      { "hole": 6,  "par": 4, "hc": 15 },
      { "hole": 7,  "par": 5, "hc": 17 },
      { "hole": 8,  "par": 4, "hc": 3 },
      { "hole": 9,  "par": 4, "hc": 5 },
      ...
    ]
  }
```

 
 Player A -> B (3) view: H2 -1, H4 -1, H6 -1
 Player A -> C (5) view: H2 -1, H3 -1, H4 -1, H5 -1, H6 -1
 Player A -> D (8) view: H2 -2, H3 -1, H4 -2, H5 -1, H6 -2
 Player A -> E (10) view: H2 -2, H3 -2, H4 -2, H5 -2, H6 -2

Player B -> A (+3) view: H2 +1, H4 +1, H6 +1



## Display Format

"*" red for handicap give 1
"**" red for handicap give 2

"*" greeen for handicap get 1
"**" green for handicap get 2



