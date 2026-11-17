/* Shared helper for CORS, in-memory OTP/Sessions, and Firebase REST integration */
const https = require('https');

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  "https://bitdial.netlify.app",
  "https://dialcaller.netlify.app"
];

function setCors(req, res) {
  const origin = req.headers.origin || "";
  const allow = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.netlify.app') || !origin;
  res.setHeader('Access-Control-Allow-Origin', allow ? (origin || '*') : '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// Firebase configuration (REST endpoint for database manipulation directly from Vercel)
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

// Generic REST request helper to Firebase Realtime Database
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
  FB_CONFIG,
  TURN_CONFIG,
  firebaseRest
};
