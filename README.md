# THE MIDDLE

THE MIDDLE is a responsive multiplayer social spectrum game. A host creates a four-character room on a shared screen, and players join from their phones. The clue-giver sees the target privately, teammates position a shared dial, and the opposing team predicts which side of the guess contains the hidden target.

## Included

- Live room codes for up to 20 players
- Two freely selectable teams
- Private clue-giver target — never sent to other clients before the reveal
- Live shared dial control
- Opposing-team left/right voting
- Automatic 4/3/2 scoring and a one-point side bonus
- First-to-10 ending with a dedicated winner screen
- Automatic clue-giver and team rotation
- Instant rematch, return-to-lobby, player removal, and reconnect support
- 224 original spectrum prompt pairs, dealt from a seeded shuffled deck so a game works through every pair before any can repeat
- Responsive host and phone interfaces
- Automated end-to-end Socket.IO game-flow tests

## Run locally

You need Node.js 18 or newer.

```bash
npm install
npm start
```

Open `http://localhost:3000` on the host screen. Phones on the same network can join using the computer’s local network address, for example `http://192.168.1.20:3000`.

## Deploy

This is a Node.js and Socket.IO application, so it needs hosting that supports a persistent Node process and WebSockets. Render, Railway, Fly.io, a VPS, or a Node-capable Hostinger plan will work. Basic static/shared hosting will not run the multiplayer server.

Use these settings on most platforms:

- Build command: `npm install`
- Start command: `npm start`
- Node version: 18 or newer

The application reads the platform-provided `PORT` environment variable automatically.

## Game flow

1. Put the host screen on a TV, projector, or shared browser window.
2. Players join the four-character room and divide into Coral and Cyan teams.
3. The active clue-giver privately sees the target position and submits one clue.
4. Their teammates discuss the clue, move the shared dial, and lock their guess.
5. The opposing team votes whether the target is left or right of the dial.
6. The host reveals the target. Scores are added automatically.
7. The other team becomes active and a new clue-giver is selected.
8. The first team to reach 10 points with a clear lead wins. A 10–10 tie continues into a deciding round.

## Scoring

- Centre band: 4 points
- Inner band: 3 points
- Outer band: 2 points
- Miss: 0 points
- Correct opposing-team side prediction: 1 point

## Production note

Rooms currently live in server memory. This keeps setup simple and works well on one application instance. Restarting the server clears active rooms. If you later want horizontal scaling or rooms that survive restarts, move room state to Redis and use the Socket.IO Redis adapter.
