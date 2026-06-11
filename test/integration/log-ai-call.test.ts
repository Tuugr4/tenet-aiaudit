import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, sampleCall, seedTenant } from '../helpers/build-test-app.js';
import { computeRecordHash } from '../../src/modules/ai-calls/hash-chain.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

describe('POST /v1/log-ai-call', () => {
  it('appends a record and returns a verifiable receipt', async () => {
    const t = await seedTenant(app);
    const body = sampleCall();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/log-ai-call',
      headers: authHeader(t.apiKey),
      payload: body,
    });
    expect(res.statusCode).toBe(201);
    const receipt = res.json();
    expect(receipt.seq).toBe(1);
    expect(receipt.prev_hash).toBe(t.genesisHash);

    // The receipt hash must be recomputable from what we sent.
    const recomputed = computeRecordHash({
      id: receipt.id,
      tenantId: t.tenantId,
      seq: 1,
      occurredAt: new Date(body.occurred_at as string).toISOString(),
      modelId: body.model_id as string,
      modelVersion: body.model_version as string,
      promptVersion: body.prompt_version as string,
      systemPurpose: body.system_purpose as string,
      dataSources: body.data_sources as string[],
      userConsent: body.user_consent as boolean,
      consentRef: body.consent_ref as string,
      humanOversight: body.human_oversight as boolean,
      oversightActor: body.oversight_actor as string,
      decisionOutput: body.decision_output,
      inputSummary: null,
      riskTier: body.risk_tier as string,
      endUserRef: body.end_user_ref as string,
      error: null,
      appeal: null,
      metadata: {},
      prevHash: t.genesisHash,
    });
    expect(receipt.record_hash).toBe(recomputed);
  });

  it('increments seq monotonically and links hashes', async () => {
    const t = await seedTenant(app);
    let prevHash = t.genesisHash;
    for (let i = 1; i <= 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/log-ai-call',
        headers: authHeader(t.apiKey),
        payload: sampleCall(),
      });
      const receipt = res.json();
      expect(receipt.seq).toBe(i);
      expect(receipt.prev_hash).toBe(prevHash);
      prevHash = receipt.record_hash;
    }
  });

  it('rejects missing required fields', async () => {
    const t = await seedTenant(app);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/log-ai-call',
      headers: authHeader(t.apiKey),
      payload: { occurred_at: new Date().toISOString() }, // no model_id / human_oversight
    });
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('batch endpoint appends up to N records under one lock', async () => {
    const t = await seedTenant(app);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/log-ai-call/batch',
      headers: authHeader(t.apiKey),
      payload: { records: Array.from({ length: 20 }, () => sampleCall()) },
    });
    expect(res.statusCode).toBe(201);
    const { receipts } = res.json();
    expect(receipts).toHaveLength(20);
    expect(receipts[0].seq).toBe(1);
    expect(receipts[19].seq).toBe(20);
    for (let i = 1; i < 20; i++) {
      expect(receipts[i].prev_hash).toBe(receipts[i - 1].record_hash);
    }
  });

  it('50 concurrent appends produce a gapless, valid chain', async () => {
    const t = await seedTenant(app);
    await Promise.all(
      Array.from({ length: 50 }, () =>
        app.inject({
          method: 'POST',
          url: '/v1/log-ai-call',
          headers: authHeader(t.apiKey),
          payload: sampleCall(),
        }),
      ),
    );
    const verify = await app.inject({
      method: 'GET',
      url: '/v1/verify-chain',
      headers: authHeader(t.apiKey),
    });
    const result = verify.json();
    expect(result.valid).toBe(true);
    expect(result.checked_records).toBe(50);
    expect(result.head_seq).toBe(50);
  });

  it('supports querying with filters and cursor pagination', async () => {
    const t = await seedTenant(app);
    await app.inject({
      method: 'POST',
      url: '/v1/log-ai-call/batch',
      headers: authHeader(t.apiKey),
      payload: {
        records: [
          sampleCall({ model_id: 'gpt-5', error: { code: 'timeout' } }),
          sampleCall({ model_id: 'claude-fable-5' }),
          sampleCall({ model_id: 'claude-fable-5' }),
        ],
      },
    });

    const byModel = await app.inject({
      method: 'GET',
      url: '/v1/ai-calls?model_id=claude-fable-5',
      headers: authHeader(t.apiKey),
    });
    expect(byModel.json().items).toHaveLength(2);

    const withErrors = await app.inject({
      method: 'GET',
      url: '/v1/ai-calls?has_error=true',
      headers: authHeader(t.apiKey),
    });
    expect(withErrors.json().items).toHaveLength(1);
    expect(withErrors.json().items[0].model_id).toBe('gpt-5');

    const page1 = await app.inject({
      method: 'GET',
      url: '/v1/ai-calls?limit=2',
      headers: authHeader(t.apiKey),
    });
    expect(page1.json().items).toHaveLength(2);
    expect(page1.json().next_cursor).toBe(page1.json().items[1].seq);
    const page2 = await app.inject({
      method: 'GET',
      url: `/v1/ai-calls?limit=2&cursor=${page1.json().next_cursor}`,
      headers: authHeader(t.apiKey),
    });
    expect(page2.json().items).toHaveLength(1);
  });
});
