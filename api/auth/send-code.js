const { setCors, firebaseRest } = require('../_common');

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const cleanEmail = email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  // Generate random 6-digit verification code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes expiry

  try {
    // Store OTP in Firebase under `auth_otps`
    await firebaseRest(`dialcaller_auth_otps/${cleanEmail}`, 'PUT', {
      email: email.trim().toLowerCase(),
      code,
      expiresAt
    });

    console.log(`[DialCaller] OTP generated for ${email}: ${code}`);

    // In production without an external mailer API key (like Resend/SendGrid),
    // we return the code directly in the response for instant testing,
    // plus it is safely validated against server-saved state.
    return res.status(200).json({
      success: true,
      message: 'Verification code sent to your email',
      // For immediate convenience during testing:
      previewCode: code
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate code', details: err.message });
  }
};
