/**
 * Resolves API/PeerJS targets based on window.API_BASE, which is set by
 * /config.js (see server.js). When the server is started normally,
 * API_BASE is '' and everything talks to this same origin. When started
 * with `npm run start:local` (node server.js --local), API_BASE points at
 * the deployed Render server so you can preview games locally against
 * real room/player data.
 *
 * Requires /config.js to be loaded before this script.
 */

// Prefixes a same-origin path like '/api/rooms' with API_BASE when set.
function apiUrl(path) {
  return (window.API_BASE || '') + path;
}

// True when this page is being served in local preview mode (npm run
// start:local), i.e. talking to a remote API_BASE instead of its own origin.
function isLocalPreview() {
  return !!window.API_BASE;
}

// Returns the PeerJS constructor options for either the local server's
// /peerjs endpoint or the remote one, depending on API_BASE.
function getPeerConfig() {
  if (window.API_BASE) {
    try {
      const u = new URL(window.API_BASE);
      return {
        host: u.hostname,
        port: parseInt(u.port) || (u.protocol === 'https:' ? 443 : 80),
        secure: u.protocol === 'https:',
        path: '/peerjs',
        debug: 0
      };
    } catch (e) {
      console.warn('Invalid API_BASE, falling back to local peer config:', e);
    }
  }
  return {
    host: location.hostname,
    port: parseInt(location.port) || (location.protocol === 'https:' ? 443 : 80),
    secure: location.protocol === 'https:',
    path: '/peerjs',
    debug: 0
  };
}
