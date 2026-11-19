const { setCors, verifyToken, signToken } = require('../_common');

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

  const { email, code, otpToken } = body;
  if (!email || !code || !otpToken) {
    return res.status(400).json({ error: 'Email, code, and verification session required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const payload = verifyToken(otpToken);

  if (!payload) {
    return res.status(400).json({ error: 'Verification code has expired or is invalid. Request a new one.' });
  }

  if (payload.email !== cleanEmail) {
    return res.status(400).json({ error: 'Email mismatch. Request a new code.' });
  }

  if (payload.code !== String(code).trim()) {
    return res.status(400).json({ error: 'Incorrect 6-digit code. Please try again.' });
  }

  // Code is 100% verified! Issue a 7-day Host Session Token
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
};
