# Head to Head Scoring

## Information to calculate H2H Scoring (this is from the Gaming Page)

--- Smith vs Mac ---
H1 Par4 x2 | Smith:4 vs Mac:3 HC:None
H2 Par3 x1 | Smith:3 vs Mac:2 HC:None
H3 Par5 x1 | Smith:5 vs Mac:6 HC:Give1
H4 Par4 x1 | Smith:4 vs Mac:6 HC:Give1
H5 Par3 x1 | Smith:- vs Mac:- HC:Give1
H6 Par4 x1 | Smith:- vs Mac:- HC:Give1
H7 Par4 x2 | Smith:- vs Mac:- HC:None
H8 Par4 x2 | Smith:- vs Mac:- HC:None
H9 Par5 x3 | Smith:7 vs Mac:4 HC:None
H10 Par4 x2 | Smith:4 vs Mac:3 HC:None
H11 Par3 x1 | Smith:- vs Mac:- HC:Give1
H12 Par4 x1 | Smith:- vs Mac:- HC:Give1
H13 Par5 x1 | Smith:- vs Mac:- HC:Give1
H14 Par3 x1 | Smith:- vs Mac:- HC:None
H15 Par4 x1 | Smith:- vs Mac:- HC:Give1
H16 Par4 x2 | Smith:- vs Mac:- HC:None
H17 Par5 x2 | Smith:- vs Mac:- HC:None
H18 Par4 x3 | Smith:- vs Mac:- HC:None
GamePlay.jsx:657 
--- Smith vs Joke ---
H1 Par4 x2 | Smith:4 vs Joke:6 HC:None
H2 Par3 x1 | Smith:3 vs Joke:4 HC:Give1
H3 Par5 x1 | Smith:5 vs Joke:7 HC:Give2
H4 Par4 x1 | Smith:4 vs Joke:3 HC:Give2
H5 Par3 x1 | Smith:- vs Joke:- HC:Give2
H6 Par4 x1 | Smith:- vs Joke:- HC:Give2
H7 Par4 x2 | Smith:- vs Joke:- HC:None
H8 Par4 x2 | Smith:- vs Joke:- HC:None
H9 Par5 x3 | Smith:7 vs Joke:6 HC:None
H10 Par4 x2 | Smith:4 vs Joke:5 HC:None
H11 Par3 x1 | Smith:- vs Joke:- HC:Give2
H12 Par4 x1 | Smith:- vs Joke:- HC:Give2
H13 Par5 x1 | Smith:- vs Joke:- HC:Give2
H14 Par3 x1 | Smith:- vs Joke:- HC:Give1
H15 Par4 x1 | Smith:- vs Joke:- HC:Give2
H16 Par4 x2 | Smith:- vs Joke:- HC:None
H17 Par5 x2 | Smith:- vs Joke:- HC:None
H18 Par4 x3 | Smith:- vs Joke:- HC:None

## Instruction 

# H2H Golf Scoring Engine — Write Code Only

You are a Copilot coding agent. Write code only (no explanation).  
Calculate Head-to-Head (H2H) golf scoring using ONLY the data provided by the Page.

DO NOT:
- connect to any database
- invent values
- hard-code scoring numbers

All configuration values already exist in the Page and are passed into the function.

---

INPUTS

1) H2H Scoring Configuration (from Page)
Provided as an object, for example:
{ "Par": 1, "Birdie": 2, "Eagle": 7, "HIO": 10 }

Values are dynamic. Always read from this object.

2) Match Logs
Multiple match blocks like:

--- PlayerA vs PlayerB ---
H1 Par4 x2 | PlayerA:4 vs PlayerB:3 HC:None
H2 Par3 x1 | PlayerA:3 vs PlayerB:3 HC:Give1
H3 Par5 x3 | PlayerA:- vs PlayerB:- HC:Get2

Meaning:
- PlayerA = Player (left)
- PlayerB = Opponent (right)
- Par3 / Par4 / Par5 = Par
- xN = Turbo multiplier
- score = Gross score ("-" means not played)
- HC = None, GiveN, or GetN

---

TERMINOLOGY (use exactly)
PlayerGross, OpponentGross
PlayerNet, OpponentNet
ScoreType
BasePoint
HolePoint
PlayerDelta

---

RULES (follow in order)

1) Pending
If PlayerGross or OpponentGross is "-":
Result = PENDING
PlayerDelta = 0

2) Net Score
HC:None
PlayerNet = PlayerGross
OpponentNet = OpponentGross

HC:GiveN
PlayerNet = PlayerGross
OpponentNet = OpponentGross - N

HC:GetN
PlayerNet = PlayerGross - N
OpponentNet = OpponentGross

3) Result (Net comparison)
PlayerNet < OpponentNet => WIN
PlayerNet > OpponentNet => LOSE
PlayerNet == OpponentNet => TIE

4) ScoreType (use PlayerGross only)
HIO: Par3 and PlayerGross = 1
Eagle: PlayerGross <= Par - 2 (exclude HIO)
Birdie: PlayerGross = Par - 1
Par: PlayerGross >= Par

5) BasePoint
BasePoint = H2HConfig[ScoreType]
Par value MUST come from config (no hard-coded 1)

6) HolePoint
HolePoint = BasePoint * Turbo

7) PlayerDelta
WIN  => +HolePoint
LOSE => -HolePoint
TIE:
- If OpponentGross < Par (opponent shot under par):
  Calculate penalty based on opponent's score type:
  - Determine OpponentScoreType (HIO/Eagle/Birdie)
  - PenaltyBasePoint = H2HConfig[OpponentScoreType]
  - ParBasePoint = H2HConfig["Par"]
  - PlayerDelta = -(PenaltyBasePoint - ParBasePoint) * Turbo
- Else => 0

---

OUTPUT

Return structured data per match:
- Per hole:
  Hole, Par, Turbo
  PlayerGross, OpponentGross
  PlayerNet, OpponentNet
  Handicap
  ScoreType
  BasePoint
  HolePoint
  Result
  PlayerDelta
- Totals:
  TotalPoints
  WIN, LOSE, TIE, PENDING counts

---

CONSTRAINTS

- No database
- No external calls
- No invented values
- Use ONLY provided input

---

DELIVERABLE

A clean deterministic function/module ready for Page usage.