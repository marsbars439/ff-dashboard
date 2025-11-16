const test = require('node:test');
const assert = require('node:assert');
const { createCloudflareAccessService } = require('../cloudflareAccess');

test('disables JWT validation when flag is falsey', async () => {
  const service = createCloudflareAccessService({ validateJwt: 'false' });
  assert.strictEqual(service.shouldValidateJwt, false);
  await assert.doesNotReject(service.verifyJwtAssertion);
});

test('normalizes Cloudflare Access domain and builds issuer', () => {
  const service = createCloudflareAccessService({
    teamDomain: 'https://example.cloudflare.com/',
    jwtAudience: 'aud',
    validateJwt: 'true'
  });

  assert.strictEqual(service.issuer, 'https://example.cloudflare.com');
  assert.strictEqual(
    service.jwksUri,
    'https://example.cloudflare.com/cdn-cgi/access/certs'
  );
});

test('throws when validation is required but config is incomplete', async () => {
  const service = createCloudflareAccessService({ validateJwt: true });
  await assert.rejects(
    () => service.verifyJwtAssertion('a.b.c'),
    /Cloudflare Access JWT validation requires CF_ACCESS_JWT_AUD/
  );
});
