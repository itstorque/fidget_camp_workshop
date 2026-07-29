/**
 * Shared helper for continuously streaming a device's motion/orientation
 * sensor data to the server once a room has been entered, and for reading
 * everyone's live sensor data back out.
 *
 * Server API:
 *   POST /api/devices/:room   { deviceId, name, orientation, motion, rotationRate }
 *   GET  /api/devices/:room   -> [ deviceData, ... ]
 *   GET  /api/devices/all     -> { roomId: [ deviceData, ... ], ... }
 */

// Call once you have a roomId + a stable deviceId (e.g. your PeerJS id) and
// motion/orientation permission has been granted. Starts listening to
// devicemotion/deviceorientation and posts the latest reading to the server
// on a fixed interval. Pass onSample(latest) to get every raw reading as soon
// as it arrives (e.g. for local live plotting), independent of the send rate.
// Returns { stop() } to tear the streaming down.
function startDeviceStreaming({ roomId, deviceId, name, intervalMs = 200, onSample }) {
  if (!roomId || !deviceId) return { stop() {} };

  const latest = {
    orientation: { alpha: 0, beta: 0, gamma: 0 },
    motion: { x: 0, y: 0, z: 0 },
    rotationRate: { alpha: 0, beta: 0, gamma: 0 }
  };
  let stopped = false;

  function onMotion(e) {
    const accel = e.acceleration || e.accelerationIncludingGravity;
    if (accel) {
      latest.motion = {
        x: Number(accel.x ?? 0),
        y: Number(accel.y ?? 0),
        z: Number(accel.z ?? 0)
      };
    }
    if (e.rotationRate) {
      latest.rotationRate = {
        alpha: Number(e.rotationRate.alpha ?? 0),
        beta: Number(e.rotationRate.beta ?? 0),
        gamma: Number(e.rotationRate.gamma ?? 0)
      };
    }
    onSample?.(latest);
  }

  function onOrientation(e) {
    latest.orientation = {
      alpha: Number(e.alpha ?? 0),
      beta: Number(e.beta ?? 0),
      gamma: Number(e.gamma ?? 0)
    };
    onSample?.(latest);
  }

  window.addEventListener('devicemotion', onMotion, { passive: true });
  window.addEventListener('deviceorientation', onOrientation, { passive: true });

  function send() {
    if (stopped) return;
    fetch(`/api/devices/${encodeURIComponent(roomId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ deviceId, name, ...latest })
    }).catch(() => {});
  }

  send();
  const timer = setInterval(send, intervalMs);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      window.removeEventListener('devicemotion', onMotion);
      window.removeEventListener('deviceorientation', onOrientation);
    }
  };
}

async function fetchRoomDevices(roomId) {
  const res = await fetch(`/api/devices/${encodeURIComponent(roomId)}`);
  if (!res.ok) throw new Error('Failed to fetch room devices');
  return res.json();
}

async function fetchAllDevices() {
  const res = await fetch('/api/devices/all');
  if (!res.ok) throw new Error('Failed to fetch devices');
  return res.json();
}

// Repeatedly fetches /api/devices/:room and hands the array of devices to
// onData. Returns { stop() } to cancel polling.
function pollRoomDevices(roomId, onData, intervalMs = 500) {
  let stopped = false;

  async function tick() {
    if (stopped) return;
    try {
      const data = await fetchRoomDevices(roomId);
      onData(data);
    } catch (e) {
      // ignore transient network errors, keep polling
    }
    if (!stopped) setTimeout(tick, intervalMs);
  }

  tick();
  return { stop() { stopped = true; } };
}

/**
 * Reusable scrolling line-chart plotter for sensor data, drawn on a <canvas>.
 * Each series keeps its own rolling buffer and is auto-scaled to fit the
 * canvas every time a new sample is pushed.
 *
 *   const plot = createSensorPlot(canvasEl, [
 *     { key: 'x', color: '#f87171' },
 *     { key: 'y', color: '#4ade80' },
 *     { key: 'z', color: '#60a5fa' }
 *   ], { maxPoints: 120 });
 *
 *   plot.push({ x, y, z });
 */
function createSensorPlot(canvas, seriesDefs, { maxPoints = 120 } = {}) {
  const ctx = canvas.getContext('2d');
  const buffers = seriesDefs.map(() => []);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, rect.width * dpr);
    canvas.height = Math.max(1, rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function push(values) {
    seriesDefs.forEach((s, i) => {
      const buf = buffers[i];
      buf.push(Number(values[s.key] ?? 0));
      if (buf.length > maxPoints) buf.shift();
    });
    draw();
  }

  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    // Auto-scale to the current buffer range
    let min = 0, max = 0;
    buffers.forEach((buf) => {
      buf.forEach((v) => {
        if (v < min) min = v;
        if (v > max) max = v;
      });
    });
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.1;
    min -= pad; max += pad;

    const zeroY = h - ((0 - min) / (max - min)) * h;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(w, zeroY);
    ctx.stroke();

    seriesDefs.forEach((s, i) => {
      const buf = buffers[i];
      if (buf.length < 2) return;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      buf.forEach((v, idx) => {
        const x = (idx / (maxPoints - 1)) * w;
        const y = h - ((v - min) / (max - min)) * h;
        if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
  }

  return {
    push,
    destroy() { window.removeEventListener('resize', resize); }
  };
}

