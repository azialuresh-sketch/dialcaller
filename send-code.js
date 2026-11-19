const { setCors, signToken } = require('../_common');

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

  const { email } = body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  // 6-digit random code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + (15 * 60 * 1000); // 15 mins

  // Cryptographically sign the code into an otpToken
  const otpToken = signToken({
    email: cleanEmail,
    code,
    exp: expiresAt
  });

  return res.status(200).json({
    success: true,
    message: 'Verification code generated',
    otpToken,
    code // Previewed directly so user can verify instantly
  });
};
