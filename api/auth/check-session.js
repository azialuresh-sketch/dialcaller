const { setCors, firebaseRest } = require('../_common');

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return res.status(200).json({ loggedIn: false });
  }

  try {
    const session = await firebaseRest(`dialcaller_sessions/${token}`, 'GET');
    if (!session || Date.now() > session.expiresAt) {
      if (session) await firebaseRest(`dialcaller_sessions/${token}`, 'DELETE');
      return res.status(200).json({ loggedIn: false });
    }

    return res.status(200).json({
      loggedIn: true,
      email: session.email
    });
  } catch (err) {
    return res.status(500).json({ error: 'Session check failed', details: err.message });
  }
};
