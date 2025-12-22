
# 01 Course Information and Handicap

Source: https://raw.githubusercontent.com/SmithMMTK/BABE_Fight/refs/heads/main/Resources/courses.json

Course Example data
```json
[
  {
    "id":"bangkok_golf",
    "name": "Bangkok Golf Club",
    "holes": [
      { "hole": 1,  "par": 4, "hc": 14 },
      { "hole": 2,  "par": 3, "hc": 10 },
      { "hole": 3,  "par": 5, "hc": 16 },
      ...
      { "hole": 17,  "par": 5, "hc": 17 },
      { "hole": 18,  "par": 4, "hc": 5 }
    ]
  },
  ...
]
```


turbo-default.json
```json
{
  "1": 2,
  "7": 2,
  "8": 2,
  "9": 3,
  "10": 2,
  "16": 2,
  "17": 2,
  "18": 3
}
```

Step 1: Load latest course information from https://raw.githubusercontent.com/SmithMMTK/BABE_Fight/refs/heads/main/Resources/courses.json 


Step 2: add one field to all hole "point": 1
Step 3: Load turbo-default.json to adjust point to become turbo
Step 4: Upload all players to have same hole and turbo hole information