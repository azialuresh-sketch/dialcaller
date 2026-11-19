/* Shared helper for CORS, JWT/HMAC token signing, and Firebase REST integration */
const https = require('https');
const crypto = require('crypto');

// Secret for signing OTPs and Sessions
const SERVER_SECRET = "dialcaller-super-secret-key-2026-xyz";

function setCors(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
}

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

// Sign token: data + signature
function signToken(payloadObj) {
  const payloadStr = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', SERVER_SECRET).update(payloadStr).digest('base64url');
  return `${payloadStr}.${sig}`;
}

// Verify token
function verifyToken(tokenStr) {
  if (!tokenStr || typeof tokenStr !== 'string') return null;
  const parts = tokenStr.split('.');
  if (parts.length !== 2) return null;
  const [payloadStr, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SERVER_SECRET).update(payloadStr).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null; // expired
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
        try {
          resolve(body ? JSON.parse(body) : null);
        } catch (e) {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = {
  setCors,
  signToken,
  verifyToken,
  FB_CONFIG,
  TURN_CONFIG,
  firebaseRest
};
