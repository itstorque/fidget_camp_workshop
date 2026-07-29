# 🌀 Sensor Games

A collection of real-time multiplayer games powered by mobile device sensors (gyroscope, accelerometer, camera). Built with **PeerJS** for ultra-low-latency P2P data streaming.

## 🎯 Games

### Gyroscope Test *(playable now)*
A target roll angle is shown. Players tilt their phones to match it, then tap to lock in. Closest angle wins — speed is the tiebreaker!

**Sensors used:** `DeviceOrientationEvent` — roll (γ), pitch (β), yaw (α)

### Instrument Symphony *(playable now)*
Each player gets a random instrument such as brass, drums, keyboard, synth, strings, or bass. The host mixes the room into a live symphony using each player's accelerometer stream.

**Sensors used:** `DeviceMotionEvent` — accelerometer x/y/z and motion magnitude

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
