const { setCors, FB_CONFIG, TURN_CONFIG } = require('./_common');

module.exports = (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({
    appName: "DialCaller",
    firebase: FB_CONFIG,
    turn: TURN_CONFIG
  });
};
