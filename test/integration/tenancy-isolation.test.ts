import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  sampleCall,
  seedAdminKey,
  seedTenant,
} from '../helpers/build-test-app.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

describe('tenancy isolation & auth matrix', () => {
  it('tenant A cannot read tenant B records', async () => {
    const a = await seedTenant(app, 'iso-a');
    const b = await seedTenant(app, 'iso-b');

    const created = await app.inject({
      method: 'POST',
      url: '/v1/log-ai-call',
      headers: authHeader(a.apiKey),
      payload: sampleCall(),
    });
    const recordId = created.json().id;

    // B's list must not contain A's record
    const listB = await app.inject({
      method: 'GET',
      url: '/v1/ai-calls',
      headers: authHeader(b.apiKey),
    });
    expect(listB.json().items).toHaveLength(0);

    // B cannot fetch A's record by id
    const getB = await app.inject({
      method: 'GET',
      url: `/v1/ai-calls/${recordId}`,
      headers: authHeader(b.apiKey),
    });
    expect(getB.statusCode).toBe(404);
  });

  it('incidents and risk assessments are tenant-scoped', async () => {
    const a = await seedTenant(app, 'iso2-a');
    const b = await seedTenant(app, 'iso2-b');

    await app.inject({
      method: 'POST',
      url: '/v1/incident-report',
      headers: authHeader(a.apiKey),
      payload: {
        occurred_at: new Date().toISOString(),
        severity: 'minor',
        title: 'A only',
        description: 'x',
      },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/risk-classify',
      headers: authHeader(a.apiKey),
      payload: { system_name: 'A system', description: 'cv screening for recruiting' },
    });

    const incidentsB = await app.inject({
      method: 'GET',
      url: '/v1/incidents',
      headers: authHeader(b.apiKey),
    });
    expect(incidentsB.json()).toHaveLength(0);

    const assessmentsB = await app.inject({
      method: 'GET',
      url: '/v1/risk-assessments',
      headers: authHeader(b.apiKey),
    });
    expect(assessmentsB.json()).toHaveLength(0);
  });

  it('requests without a key get 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/ai-calls' });
    expect(res.statusCode).toBe(401);
  });

  it('an invalid key gets 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/ai-calls',
      headers: authHeader('ta_live_invalidinvalidinvalidinvalidinvalidinv'),
    });
    expect(res.statusCode).toBe(401);
  });

  it('a tenant key cannot use admin endpoints (403)', async () => {
    const t = await seedTenant(app, 'authz');
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/tenants',
      headers: authHeader(t.apiKey),
    });
    expect(res.statusCode).toBe(403);
  });

  it('an admin key cannot use tenant endpoints (403)', async () => {
    const admin = await seedAdminKey(app);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/ai-calls',
      headers: authHeader(admin),
    });
    expect(res.statusCode).toBe(403);
  });

  it('a revoked key stops working', async () => {
    const admin = await seedAdminKey(app);
    const t = await seedTenant(app, 'revoke');

    const issued = await app.inject({
      method: 'POST',
      url: `/v1/admin/tenants/${t.tenantId}/api-keys`,
      headers: authHeader(admin),
      payload: { label: 'short-lived' },
    });
    expect(issued.statusCode).toBe(201);
    const { id: keyId, secret } = issued.json();

    const ok = await app.inject({
      method: 'GET',
      url: '/v1/ai-calls',
      headers: authHeader(secret),
    });
    expect(ok.statusCode).toBe(200);

    const revoked = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/api-keys/${keyId}`,
      headers: authHeader(admin),
    });
    expect(revoked.statusCode).toBe(204);

    const after = await app.inject({
      method: 'GET',
      url: '/v1/ai-calls',
      headers: authHeader(secret),
    });
    expect(after.statusCode).toBe(401);
  });

  it('admin can create tenants; duplicate slug conflicts', async () => {
    const admin = await seedAdminKey(app);
    const slug = `dup-${Date.now()}`;
    const first = await app.inject({
      method: 'POST',
      url: '/v1/admin/tenants',
      headers: authHeader(admin),
      payload: { name: 'Dup', slug },
    });
    expect(first.statusCode).toBe(201);
    expect(first.json().apiKey.secret).toMatch(/^ta_live_/);

    const second = await app.inject({
      method: 'POST',
      url: '/v1/admin/tenants',
      headers: authHeader(admin),
      payload: { name: 'Dup', slug },
    });
    expect(second.statusCode).toBe(409);
  });
});

describe('rate limiting', () => {
  it('returns 429 above the per-key limit', async () => {
    const limited = await buildTestApp({ RATE_LIMIT_AUTHENTICATED: 3 });
    try {
      const t = await seedTenant(limited, 'ratelimit');
      let got429 = false;
      for (let i = 0; i < 5; i++) {
        const res = await limited.inject({
          method: 'GET',
          url: '/v1/ai-calls',
          headers: authHeader(t.apiKey),
        });
        if (res.statusCode === 429) got429 = true;
      }
      expect(got429).toBe(true);
    } finally {
      await limited.close();
    }
  });
});
