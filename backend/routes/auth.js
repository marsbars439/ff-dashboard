const express = require('express');

function createAuthRouter({
  adminPassword,
  createAdminToken,
  isAdminTokenValid,
  getAdminTokenSession,
  createManagerToken,
  isManagerTokenValid,
  getManagerTokenSession,
  createPasscodeHash,
  verifyPasscodeHash,
  getAsync,
  runAsync,
  findManagerByEmail,
  cloudflareAccessLimiter,
  cloudflareAccessService
} = {}) {
  if (typeof createAdminToken !== 'function' || typeof isAdminTokenValid !== 'function') {
    throw new Error('Admin token helpers are required');
  }

  if (!getAsync || !runAsync) {
    throw new Error('Database helpers are required');
  }

  const router = express.Router();
  const {
    shouldValidateJwt = false,
    verifyJwtAssertion = async () => null,
    redactJwtAssertion = () => '',
    logDebug = () => {}
  } = cloudflareAccessService || {};

  if (cloudflareAccessLimiter) {
    router.use('/manager-auth/cloudflare', cloudflareAccessLimiter);
  }

  router.post('/admin-auth', (req, res) => {
    if (!adminPassword) {
      console.warn('Admin password is not configured.');
      return res.status(500).json({ success: false, error: 'Admin password is not configured.' });
    }

    const { password, token } = req.body || {};
    const normalizedPassword = typeof password === 'string' ? password : '';
    const normalizedToken = typeof token === 'string' ? token.trim() : '';

    if (normalizedToken) {
      if (!isAdminTokenValid(normalizedToken)) {
        return res.status(401).json({ success: false, error: 'Invalid or expired admin token' });
      }

      const session = getAdminTokenSession ? getAdminTokenSession(normalizedToken) : null;
      return res.json({
        success: true,
        token: normalizedToken,
        expiresAt: session ? new Date(session.expiresAt).toISOString() : null
      });
    }

    if (!normalizedPassword) {
      return res.status(400).json({ success: false, error: 'Password is required' });
    }

    if (normalizedPassword !== adminPassword) {
      return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
    }

    const { token: adminToken, expiresAt } = createAdminToken();

    res.json({
      success: true,
      token: adminToken,
      expiresAt: new Date(expiresAt).toISOString()
    });
  });

  router.get('/manager-auth/cloudflare', async (req, res) => {
    const cfAccessEmailHeader = req.headers['cf-access-authenticated-user-email'];
    const fallbackEmailHeader = req.headers['manager-email'];
    const emailHeader = cfAccessEmailHeader || fallbackEmailHeader;
    const jwtAssertionHeader = req.headers['cf-access-jwt-assertion'];
    const requestedEmail = typeof emailHeader === 'string' ? emailHeader.trim() : '';
    const normalizedEmail = requestedEmail.toLowerCase();

    logDebug('Received manager authentication request', {
      requestedEmail: requestedEmail || null,
      normalizedEmail: normalizedEmail || null,
      hasCfAccessEmailHeader: typeof cfAccessEmailHeader === 'string',
      hasFallbackEmailHeader: typeof fallbackEmailHeader === 'string',
      hasJwtAssertionHeader: typeof jwtAssertionHeader === 'string',
      shouldValidateJwt
    });

    if (!normalizedEmail) {
      logDebug('Rejecting request due to missing email header');
      console.warn(
        'Cloudflare Access authentication attempt missing email header (expected cf-access-authenticated-user-email or manager-email)'
      );
      return res.status(400).json({ error: 'Missing Cloudflare Access email header' });
    }

    try {
      if (shouldValidateJwt) {
        if (!jwtAssertionHeader || typeof jwtAssertionHeader !== 'string') {
          logDebug('JWT validation required but assertion header missing', {
            requestedEmail: requestedEmail || normalizedEmail
          });
          console.warn(
            `Cloudflare Access authentication missing JWT assertion for email ${requestedEmail || normalizedEmail}`
          );
          return res.status(401).json({ error: 'Invalid Cloudflare Access token' });
        }

        try {
          logDebug('Attempting JWT assertion verification', {
            requestedEmail: requestedEmail || normalizedEmail,
            jwtAssertionPreview: redactJwtAssertion(jwtAssertionHeader)
          });
          await verifyJwtAssertion(jwtAssertionHeader);
          logDebug('JWT assertion verified successfully', {
            requestedEmail: requestedEmail || normalizedEmail
          });
        } catch (jwtError) {
          logDebug('JWT assertion verification failed', {
            requestedEmail: requestedEmail || normalizedEmail,
            error: jwtError?.message
          });
          console.warn(
            `Cloudflare Access JWT validation failed for email ${requestedEmail || normalizedEmail}: ${jwtError.message}`
          );
          return res.status(401).json({ error: 'Invalid Cloudflare Access token' });
        }
      }

      const managerRow = await findManagerByEmail(requestedEmail || normalizedEmail);

      if (!managerRow) {
        logDebug('No manager mapping found for provided email', {
          requestedEmail: requestedEmail || normalizedEmail
        });
        console.warn(
          `Cloudflare Access authentication failed - no manager mapped for email ${requestedEmail || normalizedEmail}`
        );
        return res.status(404).json({ error: 'Manager not found for provided email' });
      }

      const { token, expiresAt } = createManagerToken(managerRow.name_id);

      logDebug('Manager authenticated successfully', {
        managerId: managerRow.name_id,
        managerName: managerRow.full_name
      });

      res.json({
        managerId: managerRow.name_id,
        managerName: managerRow.full_name,
        token,
        expiresAt: new Date(expiresAt).toISOString()
      });
    } catch (error) {
      console.error('Error during Cloudflare Access authentication:', error);
      res.status(500).json({ error: 'Failed to authenticate manager via Cloudflare Access' });
    }
  });

  router.post('/manager-auth/login', async (req, res) => {
    const { managerId, passcode } = req.body || {};
    const normalizedManagerId = typeof managerId === 'string' ? managerId.trim() : '';
    const normalizedPasscode = typeof passcode === 'string' ? passcode : '';

    if (!normalizedManagerId || !normalizedPasscode) {
      return res.status(400).json({ error: 'Manager ID and passcode are required' });
    }

    try {
      const managerRow = await getAsync('SELECT name_id, full_name FROM managers WHERE name_id = ?', [normalizedManagerId]);

      if (!managerRow) {
        return res.status(401).json({ error: 'Invalid manager credentials' });
      }

      const credentialRow = await getAsync(
        'SELECT passcode_hash FROM manager_credentials WHERE manager_id = ?',
        [normalizedManagerId]
      );

      if (!credentialRow || !credentialRow.passcode_hash) {
        return res.status(401).json({ error: 'Manager credentials not configured' });
      }

      const passcodeIsValid = verifyPasscodeHash(normalizedPasscode, credentialRow.passcode_hash);

      if (!passcodeIsValid) {
        return res.status(401).json({ error: 'Invalid manager credentials' });
      }

      const { token, expiresAt } = createManagerToken(managerRow.name_id);

      res.json({
        managerId: managerRow.name_id,
        managerName: managerRow.full_name,
        token,
        expiresAt: new Date(expiresAt).toISOString()
      });
    } catch (error) {
      console.error('Error authenticating manager:', error);
      res.status(500).json({ error: 'Failed to authenticate manager' });
    }
  });

  router.post('/manager-auth/passcode', async (req, res) => {
    const { managerId, passcode } = req.body || {};
    const normalizedManagerId = typeof managerId === 'string' ? managerId.trim() : '';
    const normalizedPasscode = typeof passcode === 'string' ? passcode : '';

    if (!normalizedManagerId || !normalizedPasscode) {
      return res.status(400).json({ error: 'Manager ID and passcode are required' });
    }

    try {
      const managerRow = await getAsync('SELECT name_id, full_name FROM managers WHERE name_id = ?', [normalizedManagerId]);

      if (!managerRow) {
        return res.status(404).json({ error: 'Manager not found' });
      }

      const passcodeHash = createPasscodeHash(normalizedPasscode);
      await runAsync(
        `INSERT INTO manager_credentials (manager_id, passcode_hash, created_at, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(manager_id) DO UPDATE SET
           passcode_hash = excluded.passcode_hash,
           updated_at = CURRENT_TIMESTAMP`,
        [managerRow.name_id, passcodeHash]
      );

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to set manager passcode:', error);
      res.status(500).json({ error: 'Failed to set manager passcode' });
    }
  });

  router.post('/manager-auth/validate', async (req, res) => {
    const { managerId, token } = req.body || {};
    const normalizedManagerId = typeof managerId === 'string' ? managerId.trim() : '';
    const normalizedToken = typeof token === 'string' ? token.trim() : '';

    if (!normalizedManagerId || !normalizedToken) {
      return res.status(400).json({ error: 'Manager ID and token are required' });
    }

    try {
      const managerRow = await getAsync('SELECT name_id, full_name FROM managers WHERE name_id = ?', [normalizedManagerId]);

      if (!managerRow) {
        return res.status(401).json({ error: 'Invalid manager identifier' });
      }

      if (!isManagerTokenValid(managerRow.name_id, normalizedToken)) {
        return res.status(401).json({ error: 'Invalid or expired manager token' });
      }

      const session = getManagerTokenSession ? getManagerTokenSession(normalizedToken) : null;

      res.json({
        managerId: managerRow.name_id,
        managerName: managerRow.full_name,
        expiresAt: session ? new Date(session.expiresAt).toISOString() : null
      });
    } catch (error) {
      console.error('Error validating manager token:', error);
      res.status(500).json({ error: 'Failed to validate manager token' });
    }
  });

  return router;
}

module.exports = {
  createAuthRouter
};
