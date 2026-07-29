const express = require('express');
const path = require('path');
const { ExpressPeerServer } = require('peer');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Pretty routes for static pages
app.get('/rooms', (req, res) => res.sendFile(path.join(__dirname, 'public/rooms.html')));
app.get('/docs', (req, res) => res.sendFile(path.join(__dirname, 'public/docs.html')));

// In-memory room store: roomId -> room object
const rooms = new Map();

// Clean up rooms not seen in 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (now - room.lastSeen > 60000) {
      rooms.delete(id);
      console.log(`Room ${id} expired`);
    }
  }
}, 20000);

// --- Room API ---

app.get('/api/rooms', (req, res) => {
  const { game } = req.query;
  const list = Array.from(rooms.values())
    .filter(r => !game || r.game === game)
    .map(({ roomId, name, game, hostPeerId, playerCount }) =>
      ({ roomId, name, game, hostPeerId, playerCount })
    );
  res.json(list);
});

app.post('/api/rooms', (req, res) => {
  const { name, game, hostPeerId } = req.body;
  if (!name || !game || !hostPeerId) {
    return res.status(400).json({ error: 'name, game, and hostPeerId are required' });
  }
  const roomId = Math.random().toString(36).slice(2, 8).toUpperCase();
  rooms.set(roomId, {
    roomId,
    name: String(name).slice(0, 40),
    game: String(game).slice(0, 40),
    hostPeerId: String(hostPeerId).slice(0, 80),
    playerCount: 0,
    createdAt: Date.now(),
    lastSeen: Date.now()
  });
  console.log(`Room ${roomId} created for game "${game}"`);
  res.json({ roomId });
});

app.patch('/api/rooms/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  // Only allow safe fields
  if (typeof req.body.playerCount === 'number') room.playerCount = req.body.playerCount;
  room.lastSeen = Date.now();
  res.json({ ok: true });
});

app.delete('/api/rooms/:roomId', (req, res) => {
  rooms.delete(req.params.roomId);
  res.json({ ok: true });
});

// --- Device sensor API ---
// In-memory sensor store: roomId -> Map(deviceId -> deviceData)
// Populated by continuous POSTs from play.html once a player has entered a room,
// and read by host.html (and anyone else) via GET to display everyone's live sensor data.
const devices = new Map();

function getRoomDevices(roomId) {
  if (!devices.has(roomId)) devices.set(roomId, new Map());
  return devices.get(roomId);
}

function sanitizeVector(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  const result = {};
  for (const key of keys) {
    const val = Number(obj[key]);
    result[key] = Number.isFinite(val) ? val : 0;
  }
  return result;
}

// Drop devices that haven't reported in a while (player left/closed the tab)
setInterval(() => {
  const now = Date.now();
  for (const [roomId, roomDevices] of devices) {
    for (const [deviceId, device] of roomDevices) {
      if (now - device.lastSeen > 15000) roomDevices.delete(deviceId);
    }
    if (roomDevices.size === 0) devices.delete(roomId);
  }
}, 10000);

app.post('/api/devices/:room', (req, res) => {
  const { room } = req.params;
  const { deviceId, name, orientation, motion, rotationRate } = req.body || {};
  if (!deviceId) return res.status(400).json({ error: 'deviceId is required' });

  const id = String(deviceId).slice(0, 80);
  const roomDevices = getRoomDevices(room);
  roomDevices.set(id, {
    deviceId: id,
    name: String(name || 'Player').slice(0, 40),
    room,
    orientation: sanitizeVector(orientation, ['alpha', 'beta', 'gamma']),
    motion: sanitizeVector(motion, ['x', 'y', 'z']),
    rotationRate: sanitizeVector(rotationRate, ['alpha', 'beta', 'gamma']),
    lastSeen: Date.now()
  });
  res.json({ ok: true });
});

// NOTE: must be declared before /api/devices/:room so "all" isn't captured as a room id
app.get('/api/devices/all', (req, res) => {
  const result = {};
  for (const [roomId, roomDevices] of devices) {
    result[roomId] = Array.from(roomDevices.values());
  }
  res.json(result);
});

app.get('/api/devices/:room', (req, res) => {
  const roomDevices = devices.get(req.params.room);
  res.json(roomDevices ? Array.from(roomDevices.values()) : []);
});

// --- Start server ---

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`\n🌀 Sensor Games running at http://localhost:${PORT}`);
  console.log(`   For mobile testing on local network, use your machine's IP address.\n`);
});

// --- PeerJS server (mounted at /peerjs) ---
const peerServer = ExpressPeerServer(server, {
  debug: false,
  allow_discovery: false
});
app.use('/peerjs', peerServer);

peerServer.on('connection', (client) => {
  console.log(`Peer connected: ${client.getId()}`);
});
peerServer.on('disconnect', (client) => {
  console.log(`Peer disconnected: ${client.getId()}`);
});
