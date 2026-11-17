const { setCors, firebaseRest } = require('./_common');

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const now = Date.now();
  let deletedCount = 0;

  try {
    const allMeta = (await firebaseRest('meta', 'GET')) || {};

    for (const [key, room] of Object.entries(allMeta)) {
      if (!room) continue;

      // Check if room expired (> 24 hours old) or past expiresAt
      const isExpired = (room.expiresAt && now > room.expiresAt) || 
                        (room.createdAt && (now - room.createdAt) > (24 * 60 * 60 * 1000));

      if (isExpired) {
        // Delete metadata and active room presence data
        await firebaseRest(`meta/${key}`, 'DELETE');
        await firebaseRest(`rooms/${key}`, 'DELETE');
        deletedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      deletedRooms: deletedCount,
      timestamp: now
    });
  } catch (err) {
    return res.status(500).json({ error: 'Cleanup failed', details: err.message });
  }
};
