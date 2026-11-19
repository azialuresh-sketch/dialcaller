const { setCors, verifyToken, firebaseRest } = require('./_common');

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const session = verifyToken(token);

  // POST: Create a Room
  if (req.method === 'POST') {
    if (!session || !session.email) {
      return res.status(401).json({ error: 'You must be logged in as a host to create a room' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    const { name, password, capacity } = body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Room name required (min 2 characters)' });
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
      expiresAt: now + (24 * 60 * 60 * 1000), // Exactly 24 hours
      createdBy: session.email
    };

    // Store in Firebase meta
    await firebaseRest(`meta/${key}`, 'PUT', roomMeta).catch(() => {});

    // Save in Host's room list
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

  // GET: Get Host's Rooms
  if (req.method === 'GET') {
    if (!session || !session.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

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

  // DELETE: Delete a Room
  if (req.method === 'DELETE') {
    if (!session || !session.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const roomKey = url.searchParams.get('key');
    if (!roomKey) return res.status(400).json({ error: 'Missing room key parameter' });

    const hostKey = session.email.replace(/[^a-z0-9]/g, '_');
    await firebaseRest(`meta/${roomKey}`, 'DELETE').catch(() => {});
    await firebaseRest(`rooms/${roomKey}`, 'DELETE').catch(() => {});
    await firebaseRest(`dialcaller_user_rooms/${hostKey}/${roomKey}`, 'DELETE').catch(() => {});

    return res.status(200).json({ success: true, deleted: roomKey });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
