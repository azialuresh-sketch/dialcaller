const { setCors, firebaseRest } = require('./_common');

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // POST: Create a private room (requires logged in host)
  if (req.method === 'POST') {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) return res.status(401).json({ error: 'You must be logged in to create a room' });

    const session = await firebaseRest(`dialcaller_sessions/${token}`, 'GET');
    if (!session || Date.now() > session.expiresAt) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    const { name, password, capacity } = req.body || {};
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Room name is required (min 2 chars)' });
    }

    const key = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 50);
    const existing = await firebaseRest(`meta/${key}`, 'GET');
    if (existing && existing.status !== 'ended') {
      return res.status(400).json({ error: 'A room with this name is already active' });
    }

    const now = Date.now();
    const roomMeta = {
      name: name.trim(),
      password: (password || '').trim(),
      capacity: Math.min(100, Math.max(2, parseInt(capacity, 10) || 12)),
      type: 'room',
      status: 'active',
      locked: false,
      createdAt: now,
      expiresAt: now + (24 * 60 * 60 * 1000), // Exactly 1-day TTL
      createdBy: session.email
    };

    // Save to Firebase meta
    await firebaseRest(`meta/${key}`, 'PUT', roomMeta);

    // Save under the host's private room list so only they can see it!
    const hostKey = session.email.replace(/[^a-z0-9]/g, '_');
    await firebaseRest(`dialcaller_user_rooms/${hostKey}/${key}`, 'PUT', {
      key,
      name: roomMeta.name,
      createdAt: now,
      expiresAt: roomMeta.expiresAt
    });

    return res.status(200).json({
      success: true,
      roomKey: key,
      room: roomMeta
    });
  }

  // GET: Fetch ONLY the rooms created by the logged-in user (Private Rooms)
  if (req.method === 'GET') {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const session = await firebaseRest(`dialcaller_sessions/${token}`, 'GET');
    if (!session || Date.now() > session.expiresAt) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hostKey = session.email.replace(/[^a-z0-9]/g, '_');
    const userRooms = (await firebaseRest(`dialcaller_user_rooms/${hostKey}`, 'GET')) || {};

    const list = [];
    const now = Date.now();

    for (const [key, r] of Object.entries(userRooms)) {
      if (r && r.expiresAt && now < r.expiresAt) {
        list.push(r);
      } else {
        // Clean up expired from user list
        await firebaseRest(`dialcaller_user_rooms/${hostKey}/${key}`, 'DELETE');
      }
    }

    return res.status(200).json({ rooms: list });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
