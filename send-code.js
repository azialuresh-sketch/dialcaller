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

  const { email } = body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const cleanEmail = email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + (10 * 60 * 1000);

  try {
    await firebaseRest(`dialcaller_auth_otps/${cleanEmail}`, 'PUT', {
      email: email.trim().toLowerCase(),
      code,
      expiresAt
    });

    return res.status(200).json({
      success: true,
      message: 'Verification code generated',
      previewCode: code
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error saving code', details: err.message });
  }
};
