import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, sampleCall, seedTenant } from '../helpers/build-test-app.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

async function seedWithRecords(n: number) {
  const t = await seedTenant(app, 'verify');
  await app.inject({
    method: 'POST',
    url: '/v1/log-ai-call/batch',
    headers: authHeader(t.apiKey),
    payload: { records: Array.from({ length: n }, () => sampleCall()) },
  });
  return t;
}

describe('GET /v1/verify-chain', () => {
  it('verifies a clean chain', async () => {
    const t = await seedWithRecords(10);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/verify-chain',
      headers: authHeader(t.apiKey),
    });
    expect(res.json()).toMatchObject({ valid: true, checked_records: 10, head_seq: 10 });
  });

  it('reports the exact seq after raw-SQL tampering', async () => {
    const t = await seedWithRecords(10);
    // Tamper directly in the database, bypassing the API.
    await app.db`
      UPDATE ai_call_logs SET human_oversight = NOT human_oversight
      WHERE tenant_id = ${t.tenantId} AND seq = 7
    `;
    const res = await app.inject({
      method: 'GET',
      url: '/v1/verify-chain',
      headers: authHeader(t.apiKey),
    });
    const result = res.json();
    expect(result.valid).toBe(false);
    expect(result.first_invalid_seq).toBe(7);
    expect(result.reason).toContain('tampering');
  });

  it('detects deleted records', async () => {
    const t = await seedWithRecords(10);
    await app.db`DELETE FROM ai_call_logs WHERE tenant_id = ${t.tenantId} AND seq = 4`;
    const res = await app.inject({
      method: 'GET',
      url: '/v1/verify-chain',
      headers: authHeader(t.apiKey),
    });
    const result = res.json();
    expect(result.valid).toBe(false);
    expect(result.first_invalid_seq).toBe(4);
    expect(result.reason).toContain('missing');
  });

  it('verifies a sub-range anchored on the prior record', async () => {
    const t = await seedWithRecords(10);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/verify-chain?from_seq=5&to_seq=8',
      headers: authHeader(t.apiKey),
    });
    expect(res.json()).toMatchObject({ valid: true, checked_records: 4 });
  });

  it('an empty chain is valid', async () => {
    const t = await seedTenant(app, 'empty');
    const res = await app.inject({
      method: 'GET',
      url: '/v1/verify-chain',
      headers: authHeader(t.apiKey),
    });
    expect(res.json()).toMatchObject({ valid: true, checked_records: 0, head_seq: 0 });
  });
});
