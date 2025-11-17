const axios = require('axios');
const crypto = require('crypto');

const decodeBase64Url = (input) => {
  if (typeof input !== 'string') {
    return Buffer.alloc(0);
  }

  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  return Buffer.from(normalized + '='.repeat(padding), 'base64');
};

const normalizeTeamDomain = (rawDomain = '') => {
  if (typeof rawDomain !== 'string') {
    return '';
  }

  return rawDomain.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
};

const normalizeBooleanFlag = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'required'].includes(value.trim().toLowerCase());
  }

  return false;
};

const ensureNumber = (value, fallback) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback;
};

function createCloudflareAccessService({
  teamDomain = '',
  jwtAudience = '',
  validateJwt = false,
  jwksCacheMs = 60 * 60 * 1000,
  jwksTimeoutMs = 5000,
  logger = console
} = {}) {
  const normalizedDomain = normalizeTeamDomain(teamDomain);
  const issuer = normalizedDomain ? `https://${normalizedDomain}` : '';
  const jwksUri = issuer ? `${issuer}/cdn-cgi/access/certs` : '';
  const shouldValidateJwt = normalizeBooleanFlag(validateJwt);
  const normalizedAudience = typeof jwtAudience === 'string' ? jwtAudience.trim() : '';
  const cacheMs = ensureNumber(jwksCacheMs, 60 * 60 * 1000);
  const timeoutMs = ensureNumber(jwksTimeoutMs, 5000);

  const jwksCache = {
    keys: null,
    expiresAt: 0
  };

  const logDebug = (message, details) => {
    const prefix = '[Cloudflare Access]';
    if (details) {
      logger.debug?.(`${prefix} ${message}`, details);
    } else {
      logger.debug?.(`${prefix} ${message}`);
    }
  };

  const redactJwtAssertion = (token) => {
    if (!token || typeof token !== 'string') {
      return '';
    }

    if (token.length <= 16) {
      return `${token.slice(0, 4)}...`;
    }

    return `${token.slice(0, 8)}...${token.slice(-8)}`;
  };

  const fetchCloudflareJwks = async () => {
    if (!jwksUri) {
      throw new Error('Cloudflare Access JWKS URI is not configured');
    }

    if (jwksCache.keys && jwksCache.expiresAt > Date.now()) {
      logDebug('Using cached JWKS response', {
        cachedKeyCount: jwksCache.keys.length,
        cacheExpiresAt: new Date(jwksCache.expiresAt).toISOString()
      });
      return jwksCache.keys;
    }

    logDebug('Fetching JWKS from Cloudflare', {
      jwksUri,
      requestTimeoutMs: timeoutMs
    });

    const response = await axios.get(jwksUri, { timeout: timeoutMs });
    const keys = Array.isArray(response?.data?.keys) ? response.data.keys : [];

    if (!keys.length) {
      throw new Error('No signing keys returned from Cloudflare Access');
    }

    jwksCache.keys = keys;
    jwksCache.expiresAt = Date.now() + cacheMs;

    logDebug('Received JWKS response from Cloudflare', {
      signingKeyCount: keys.length,
      cacheExpiresAt: new Date(jwksCache.expiresAt).toISOString()
    });

    return keys;
  };

  const verifyJwtAssertion = async (token) => {
    if (!shouldValidateJwt) {
      return null;
    }

    if (!token || typeof token !== 'string') {
      logDebug('JWT assertion header missing or not a string');
      throw new Error('Missing CF-Access-Jwt-Assertion header');
    }

    if (!normalizedAudience || !issuer) {
      logDebug('JWT validation prerequisites are not configured', {
        hasAudience: Boolean(normalizedAudience),
        hasIssuer: Boolean(issuer)
      });
      throw new Error('Cloudflare Access JWT validation requires CF_ACCESS_JWT_AUD and CF_ACCESS_TEAM_DOMAIN');
    }

    const segments = token.split('.');
    if (segments.length !== 3) {
      logDebug('JWT assertion is not in the expected three-segment format', {
        segmentCount: segments.length
      });
      throw new Error('Malformed Cloudflare Access token');
    }

    const [headerSegment, payloadSegment, signatureSegment] = segments;

    let header;
    let payload;
    try {
      header = JSON.parse(decodeBase64Url(headerSegment).toString('utf8'));
    } catch (error) {
      logDebug('Failed to decode JWT header segment', {
        error: error.message
      });
      throw new Error('Invalid Cloudflare Access token header');
    }

    if (!header || header.alg !== 'RS256') {
      logDebug('Unsupported JWT algorithm encountered', {
        headerAlgorithm: header?.alg,
        headerKid: header?.kid
      });
      throw new Error('Unsupported Cloudflare Access token algorithm');
    }

    try {
      payload = JSON.parse(decodeBase64Url(payloadSegment).toString('utf8'));
    } catch (error) {
      logDebug('Failed to decode JWT payload segment', {
        error: error.message,
        headerKid: header?.kid
      });
      throw new Error('Invalid Cloudflare Access token payload');
    }

    let keys = await fetchCloudflareJwks();
    let signingKeyJwk = keys.find((key) => key.kid === header.kid);

    if (!signingKeyJwk) {
      logDebug('Signing key not found in cached JWKS, refreshing', {
        requestedKid: header.kid
      });
      jwksCache.keys = null;
      jwksCache.expiresAt = 0;
      keys = await fetchCloudflareJwks();
      signingKeyJwk = keys.find((key) => key.kid === header.kid);
    }

    if (!signingKeyJwk) {
      logDebug('Unable to locate signing key for JWT assertion', {
        requestedKid: header.kid,
        availableKids: keys.map((key) => key.kid)
      });
      throw new Error('Unable to locate signing key for Cloudflare Access token');
    }

    let publicKey;
    try {
      publicKey = crypto.createPublicKey({
        key: {
          kty: signingKeyJwk.kty,
          n: signingKeyJwk.n,
          e: signingKeyJwk.e
        },
        format: 'jwk'
      });
    } catch (error) {
      throw new Error(`Unable to construct Cloudflare Access public key: ${error.message}`);
    }

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerSegment}.${payloadSegment}`);
    verifier.end();

    const signature = decodeBase64Url(signatureSegment);
    const isValidSignature = verifier.verify(publicKey, signature);

    if (!isValidSignature) {
      logDebug('JWT signature verification failed', {
        headerKid: header?.kid
      });
      throw new Error('Invalid Cloudflare Access token signature');
    }

    const audience = payload?.aud;
    const audienceMatches = Array.isArray(audience)
      ? audience.includes(normalizedAudience)
      : audience === normalizedAudience;

    if (!audienceMatches) {
      logDebug('JWT audience mismatch', {
        expectedAudience: normalizedAudience,
        providedAudience: audience
      });
      throw new Error('Cloudflare Access token audience mismatch');
    }

    if (payload?.iss !== issuer) {
      logDebug('JWT issuer mismatch', {
        expectedIssuer: issuer,
        providedIssuer: payload?.iss
      });
      throw new Error('Cloudflare Access token issuer mismatch');
    }

    const currentEpochSeconds = Math.floor(Date.now() / 1000);

    if (typeof payload?.exp === 'number' && currentEpochSeconds >= payload.exp) {
      logDebug('JWT has expired', {
        expiresAt: payload?.exp,
        now: currentEpochSeconds
      });
      throw new Error('Cloudflare Access token has expired');
    }

    if (typeof payload?.nbf === 'number' && currentEpochSeconds < payload.nbf) {
      logDebug('JWT not yet valid', {
        notBefore: payload?.nbf,
        now: currentEpochSeconds
      });
      throw new Error('Cloudflare Access token is not yet valid');
    }

    return {
      header,
      payload
    };
  };

  return {
    issuer,
    jwksUri,
    shouldValidateJwt,
    verifyJwtAssertion,
    redactJwtAssertion,
    logDebug
  };
}

module.exports = {
  createCloudflareAccessService
};
