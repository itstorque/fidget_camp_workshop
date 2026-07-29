# 🌀 Sensor Games

A collection of real-time multiplayer games powered by mobile device sensors (gyroscope, accelerometer, camera). Built with **PeerJS** for ultra-low-latency P2P data streaming.

## 🎯 Games

### Gyroscope Test *(playable now)*
A target roll angle is shown. Players tilt their phones to match it, then tap to lock in. Closest angle wins — speed is the tiebreaker!

**Sensors used:** `DeviceOrientationEvent` — roll (γ), pitch (β), yaw (α)

### Instrument Symphony *(playable now)*
Each player gets a random instrument such as brass, drums, keyboard, synth, strings, or bass. The host mixes the room into a live symphony using each player's accelerometer stream.

**Sensors used:** `DeviceMotionEvent` — accelerometer x/y/z and motion magnitude

### Sensor Skeleton *(playable now)*
A minimal starter/reference game showing the accelerometer + gyroscope streaming pattern with live scrolling charts. Use it as a template for new games.

**Sensors used:** `DeviceMotionEvent` + `DeviceOrientationEvent`

### Trail Blazer *(playable now)*
Everyone starts at the host's origin on a shared canvas. Tilt your phone to "walk" — the host integrates each player's accelerometer stream into a position and draws a trail behind them. The camera smoothly zooms out to keep everyone in view.

**Sensors used:** `DeviceMotionEvent` — accelerometer x/y integrated into 2D position

### Coming Soon
- **Shake Race** — accelerometer speed challenge
- **Scavenger Snap** — camera + computer vision
- **Light Duel** — ambient light sensor co-op

---

## 🚀 Quick Start

```bash
npm install
npm start
```

Then open **http://localhost:3000** in a browser.

### Testing on Mobile

You need phones and the server to be on the **same local network**, or you can use a tunnel like [ngrok](https://ngrok.com):

```bash
ngrok http 3000
```

Share the ngrok URL with players. iOS requires **HTTPS** for `DeviceOrientationEvent` permission — ngrok provides this automatically.

## ☁️ Deploying to Render

The app is fully host-agnostic: every client page talks to `/api/...` and PeerJS using
relative paths / `location.hostname`, and `server.js` reads `process.env.PORT`. No code
changes or hardcoded URLs are needed to deploy elsewhere.

1. Push this repo to GitHub and create a new **Web Service** on [Render](https://render.com)
   pointing at it.
2. Build command: `npm install`. Start command: `npm start`.
3. Render provides HTTPS automatically, so `DeviceOrientationEvent`/`DeviceMotionEvent`
   permissions work out of the box — no ngrok needed.
4. Once deployed, just open `https://fidget-camp-workshop.onrender.com` on phones/host —
   the room API, device sensor streaming, and PeerJS signaling all resolve against that
   same origin automatically.

Note: on Render's free tier the service spins down after inactivity, so the first
request after idling may take ~30s+ to wake the server back up.

### Previewing games locally against the live Render server

By default `npm start` uses this server's own `/api/...` and `/peerjs` endpoints.
To instead preview a game locally while its API calls (rooms, live device data,
PeerJS signaling) hit the deployed `fidget-camp-workshop.onrender.com` server —
useful for seeing real room/player data with no local players — run:

```bash
npm run start:local
```

This starts the local server with a `--local` flag, which serves a small
`/config.js` that points `window.API_BASE` at the Render URL. All game pages
read this via `apiUrl()` / `getPeerConfig()` (see `public/js/api-config.js`).
Override the target with `REMOTE_API_BASE=https://your-app.onrender.com npm run start:local`
if needed.

---

## 🏗️ Architecture

```
/ (Express + PeerJS server)
├── GET  /api/rooms          — list open rooms
├── POST /api/rooms          — create a room
├── PATCH /api/rooms/:id     — heartbeat / update player count
└── DELETE /api/rooms/:id    — close a room

/peerjs                      — PeerJS signaling server
```

**Data flow:**
1. Host creates a PeerJS peer and registers a room via the REST API
2. Players browse `/rooms`, select a room, connect to the host's PeerJS peer
3. All game data (orientation stream, commits, round state) flows **directly P2P** — no server round-trips
4. Orientation events are streamed at ~20 fps while the round is active

---

## ➕ Adding a New Game

1. Create `public/games/your-game/host.html` and `play.html`
2. Add a game card to `public/index.html`
3. Add the game to the `GAME_META` map in `public/rooms.html`
4. Your game communicates with the same PeerJS + room API pattern

The message protocol is plain JSON objects with a `type` field — easy to extend.

---

## 📡 PeerJS Message Protocol

### Host → Player
| type | payload | description |
|------|---------|-------------|
| `welcome` | `{ gameState, targetAngle, players }` | sent on connect |
| `instrument-assigned` | `{ instrument }` | sent to a player after join in Instrument Symphony |
| `symphony-start` | `{ startedAt }` | host begins the live mix |
| `symphony-stop` | — | host pauses the live mix |
| `round-start` | `{ targetAngle, duration, elapsed }` | round begins |
| `player-joined` | `{ peerId, name }` | someone joined |
| `player-left` | `{ peerId, name }` | someone left |
| `player-committed` | `{ peerId, name, angle }` | someone locked in |
| `committed-so-far` | `{ players }` | late-join catch-up |
| `round-end` | `{ results, winner, targetAngle, scores }` | round over |
| `game-ended` | — | host closed game |

### Player → Host
| type | payload | description |
|------|---------|-------------|
| `join` | `{ name }` | register with name |
| `motion` | `{ x, y, z, magnitude, timestamp }` | streamed accelerometer data |
| `orientation` | `{ roll, pitch, yaw, timestamp }` | streamed ~20fps |
| `commit` | `{ roll, pitch, yaw, timestamp }` | lock in angle |
