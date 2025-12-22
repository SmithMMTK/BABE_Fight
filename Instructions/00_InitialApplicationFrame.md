# Initial Application Frame

- Application Name is BABE Fight 
- Initial Application to render on mobile target to iOS mainly and Andriod
- Preferred Framework nodejs between Web Browser and API Server
- It is a multi-player Golf Scorecard Tracking, everyone can input their score and another player can see live time score
- Data must auto refresh, sync (latest data win)
- This should be stateless on mobile device, which mean user can login by PIN and User Name on any device, and in case switch mobile device they can resume game with PIN and User Name 
- This targetted to run on Azure App Services (on single App Service) but able to test in local machine (macOS)
- Use persistant storage on Azure App Services (to save database cost)
- There are two role : HOST & GUEST
- Interface must support Zoom In-Out font or large font on small device and rotate orientation 
- UI color and text size must support accessibility 

User Journey:

User will see two choice to join game:

Join as HOST:
- Select course title from Source: https://raw.githubusercontent.com/SmithMMTK/BABE_Fight/refs/heads/main/Resources/courses.json
- Type Name
- Start game as HOST
- System random unique PIN (by easy to remember to pass to player)
   - HOST PIN : To join as Co-Host
   - GUEST PIN : TO join as Guest

Join as GUEST:
- Enter PIN
- Type Name
- Join Game (then detect PIN and User Name to join session)

There are one menu for HOST to:
- Add member
- Assign Role
- Remove
*** Becareful to remove themself from game ***


