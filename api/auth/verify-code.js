const crypto = require('crypto');
const { setCors, firebaseRest } = require('../_common');

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const { email, code } = body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and verification code required' });
  }

  const cleanEmail = email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');

  try {
    const saved = await firebaseRest(`dialcaller_auth_otps/${cleanEmail}`, 'GET');

    if (!saved || !saved.code) {
      return res.status(400).json({ error: 'No code requested for this email' });
    }

    if (Date.now() > saved.expiresAt) {
      await firebaseRest(`dialcaller_auth_otps/${cleanEmail}`, 'DELETE');
      return res.status(400).json({ error: 'Code expired. Request a new one.' });
    }

    if (saved.code.trim() !== String(code).trim()) {
      return res.status(400).json({ error: 'Incorrect verification code' });
    }

    await firebaseRest(`dialcaller_auth_otps/${cleanEmail}`, 'DELETE');

    const token = crypto.randomBytes(32).toString('hex');
    const userSession = {
      token,
      email: email.trim().toLowerCase(),
      createdAt: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000)
    };

    await firebaseRest(`dialcaller_sessions/${token}`, 'PUT', userSession);

    return res.status(200).json({
      success: true,
      token,
      email: userSession.email
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
};
