/* 
  Single-file Vercel Backend Handler
  Handles ALL endpoints in one place:
    - GET  /api?action=config
    - POST /api?action=send-code
    - POST /api?action=verify-code
    - GET  /api?action=check-session
    - GET  /api?action=rooms
    - POST /api?action=rooms
    - DELETE /api?action=rooms&key=...
    - GET  /api?action=cleanup
*/
const https = require('https');
const crypto = require('crypto');

const SERVER_SECRET = "dialcaller-super-secret-key-2026-xyz";
const FB_URL = "https://izoom-dfd1b-default-rtdb.firebaseio.com";

const FB_CONFIG = {
  apiKey: "AIzaSyDu5o3gx45ibx9l5hNlObxN_5LvepT6KHs",
  authDomain: "izoom-dfd1b.firebaseapp.com",
  databaseURL: FB_URL,
  projectId: "izoom-dfd1b",
  storageBucket: "izoom-dfd1b.firebasestorage.app",
  messagingSenderId: "712297999617",
  appId: "1:712297999617:web:e278197776bfb7eadfff00"
};

const TURN_CONFIG = {
  urls: [
    "turn:free.expressturn.com:3478",
    "turn:free.expressturn.com:3478?transport=tcp"
  ],
  username: "000000002109528002",
  credential: "JwWm/r57fxwOTs8uDygdqs8s5Ns="
};

function signToken(payloadObj) {
  const payloadStr = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', SERVER_SECRET).update(payloadStr).digest('base64url');
  return `${payloadStr}.${sig}`;
}

function verifyToken(tokenStr) {
  if (!tokenStr || typeof tokenStr !== 'string') return null;
  const parts = tokenStr.split('.');
  if (parts.length !== 2) return null;
  const [payloadStr, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SERVER_SECRET).update(payloadStr).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function firebaseRest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${FB_URL}/${path}.json`);
    const payload = data ? JSON.stringify(data) : null;
    const req = https.request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(body ? JSON.parse(body) : null); } catch { resolve(body); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = async (req, res) => {
  // Global CORS
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse Action from URL or Path
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let action = url.searchParams.get('action');

  if (!action) {
    const cleanPath = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
    if (cleanPath === 'config') action = 'config';
    else if (cleanPath === 'auth/send-code' || cleanPath === 'send-code') action = 'send-code';
    else if (cleanPath === 'auth/verify-code' || cleanPath === 'verify-code') action = 'verify-code';
    else if (cleanPath === 'auth/check-session' || cleanPath === 'check-session') action = 'check-session';
    else if (cleanPath === 'rooms') action = 'rooms';
    else if (cleanPath === 'cleanup') action = 'cleanup';
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  /* 1. CONFIG */
  if (action === 'config' || (!action && req.method === 'GET')) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({
      appName: "DialCaller",
      firebase: FB_CONFIG,
      turn: TURN_CONFIG
    });
  }

  /* 2. SEND OTP CODE */
  if (action === 'send-code') {
    const { email } = body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const otpToken = signToken({
      email: cleanEmail,
      code,
      exp: Date.now() + (15 * 60 * 1000)
    });

    return res.status(200).json({
      success: true,
      message: 'Verification code generated',
      otpToken,
      code
    });
  }

  /* 3. VERIFY OTP CODE */
  if (action === 'verify-code') {
    const { email, code, otpToken } = body;
    if (!email || !code || !otpToken) {
      return res.status(400).json({ error: 'Missing email, code, or session' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const payload = verifyToken(otpToken);

    if (!payload || payload.email !== cleanEmail) {
      return res.status(400).json({ error: 'Code expired or invalid. Please request a new one.' });
    }
    if (payload.code !== String(code).trim()) {
      return res.status(400).json({ error: 'Incorrect 6-digit code. Please try again.' });
    }

    const sessionToken = signToken({
      email: cleanEmail,
      role: 'host',
      iat: Date.now(),
      exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
    });

    return res.status(200).json({
      success: true,
      token: sessionToken,
      email: cleanEmail
    });
  }

  /* 4. CHECK SESSION */
  if (action === 'check-session') {
    if (!token) return res.status(200).json({ loggedIn: false });
    const payload = verifyToken(token);
    if (!payload || !payload.email) return res.status(200).json({ loggedIn: false });
    return res.status(200).json({ loggedIn: true, email: payload.email });
  }

  /* 5. ROOMS (CREATE, LIST, DELETE) */
  if (action === 'rooms') {
    const session = verifyToken(token);
    if (!session || !session.email) {
      return res.status(401).json({ error: 'Host authentication required' });
    }

    // POST: Create
    if (req.method === 'POST') {
      const { name, password, capacity } = body;
      if (!name || name.trim().length < 2) {
        return res.status(400).json({ error: 'Room name required (min 2 chars)' });
      }

      const key = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 50);
      const now = Date.now();
      const roomMeta = {
        name: name.trim(),
        password: (password || '').trim(),
        capacity: Math.min(100, Math.max(2, parseInt(capacity, 10) || 12)),
        type: 'room',
        status: 'active',
        locked: false,
        createdAt: now,
        expiresAt: now + (24 * 60 * 60 * 1000),
        createdBy: session.email
      };

      await firebaseRest(`meta/${key}`, 'PUT', roomMeta).catch(() => {});
      const hostKey = session.email.replace(/[^a-z0-9]/g, '_');
      await firebaseRest(`dialcaller_user_rooms/${hostKey}/${key}`, 'PUT', {
        key,
        name: roomMeta.name,
        password: roomMeta.password,
        createdAt: now,
        expiresAt: roomMeta.expiresAt
      }).catch(() => {});

      return res.status(200).json({ success: true, roomKey: key, room: roomMeta });
    }

    // GET: List Host Rooms
    if (req.method === 'GET') {
      const hostKey = session.email.replace(/[^a-z0-9]/g, '_');
      const userRooms = (await firebaseRest(`dialcaller_user_rooms/${hostKey}`, 'GET').catch(() => ({}))) || {};
      const list = [];
      const now = Date.now();

      for (const [key, r] of Object.entries(userRooms)) {
        if (r && r.expiresAt && now < r.expiresAt) {
          list.push(r);
        } else {
          await firebaseRest(`dialcaller_user_rooms/${hostKey}/${key}`, 'DELETE').catch(() => {});
        }
      }
      return res.status(200).json({ rooms: list });
    }

    // DELETE: Delete Room
    if (req.method === 'DELETE') {
      const roomKey = url.searchParams.get('key');
      if (!roomKey) return res.status(400).json({ error: 'Missing room key parameter' });

      const hostKey = session.email.replace(/[^a-z0-9]/g, '_');
      await firebaseRest(`meta/${roomKey}`, 'DELETE').catch(() => {});
      await firebaseRest(`rooms/${roomKey}`, 'DELETE').catch(() => {});
      await firebaseRest(`dialcaller_user_rooms/${hostKey}/${roomKey}`, 'DELETE').catch(() => {});

      return res.status(200).json({ success: true, deleted: roomKey });
    }
  }

  /* 6. CLEANUP */
  if (action === 'cleanup') {
    const now = Date.now();
    const allMeta = (await firebaseRest('meta', 'GET').catch(() => ({}))) || {};
    let count = 0;
    for (const [key, room] of Object.entries(allMeta)) {
      if (!room) continue;
      const isExpired = (room.expiresAt && now > room.expiresAt) || (room.createdAt && (now - room.createdAt) > (24 * 60 * 60 * 1000));
      if (isExpired) {
        await firebaseRest(`meta/${key}`, 'DELETE').catch(() => {});
        await firebaseRest(`rooms/${key}`, 'DELETE').catch(() => {});
        count++;
      }
    }
    return res.status(200).json({ success: true, deletedRooms: count });
  }

  return res.status(404).json({ error: 'Unknown action' });
};
