import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import unzipper from 'unzipper';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, sampleCall, seedTenant } from '../helpers/build-test-app.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

describe('GET /v1/export-audit-pack', () => {
  it('produces a ZIP with PDF summary, evidence files and a consistent manifest', async () => {
    const t = await seedTenant(app, 'pack');
    await app.inject({
      method: 'POST',
      url: '/v1/log-ai-call/batch',
      headers: authHeader(t.apiKey),
      payload: {
        records: Array.from({ length: 7 }, (_, i) =>
          sampleCall({ occurred_at: `2026-06-0${(i % 7) + 1}T10:00:00Z` }),
        ),
      },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/incident-report',
      headers: authHeader(t.apiKey),
      payload: {
        occurred_at: '2026-06-03T10:00:00Z',
        severity: 'serious',
        title: 'Bias incident',
        description: 'details',
      },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/risk-classify',
      headers: authHeader(t.apiKey),
      payload: { system_name: 'Screener', description: 'cv screening for recruitment' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/export-audit-pack?from=2026-06-01T00:00:00Z&to=2026-06-30T23:59:59Z',
      headers: authHeader(t.apiKey),
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/zip');
    expect(res.headers['content-disposition']).toContain('attachment');
    const packId = res.headers['x-pack-id'] as string;
    expect(packId).toBeTruthy();

    const zip = await unzipper.Open.buffer(res.rawPayload);
    const paths = zip.files.map((f) => f.path).sort();
    expect(paths).toEqual(
      [
        'audit-pack/summary.pdf',
        'audit-pack/manifest.json',
        'audit-pack/evidence/ai-calls-0001.json',
        'audit-pack/evidence/risk-assessments.json',
        'audit-pack/evidence/incidents.json',
        'audit-pack/chain-verification.json',
      ].sort(),
    );

    // PDF really is a PDF
    const pdf = await zip.files.find((f) => f.path === 'audit-pack/summary.pdf')!.buffer();
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');

    // Manifest hashes match actual file contents
    const manifest = JSON.parse(
      (await zip.files.find((f) => f.path === 'audit-pack/manifest.json')!.buffer()).toString(),
    );
    expect(manifest.pack_id).toBe(packId);
    expect(manifest.chain_verified).toBe(true);
    expect(manifest.record_count).toBe(7);
    for (const entry of manifest.files) {
      const file = zip.files.find((f) => f.path === entry.path)!;
      const buf = await file.buffer();
      expect(createHash('sha256').update(buf).digest('hex')).toBe(entry.sha256);
    }

    // Evidence is re-verifiable
    const verification = JSON.parse(
      (
        await zip.files.find((f) => f.path === 'audit-pack/chain-verification.json')!.buffer()
      ).toString(),
    );
    expect(verification.valid).toBe(true);
    expect(verification.checked_records).toBe(7);
    expect(verification.genesis_hash).toBe(t.genesisHash);

    const incidents = JSON.parse(
      (
        await zip.files.find((f) => f.path === 'audit-pack/evidence/incidents.json')!.buffer()
      ).toString(),
    );
    expect(incidents).toHaveLength(1);
    expect(incidents[0].is_article_73).toBe(true);

    // Provenance row was written with the pack hash
    await new Promise((r) => setTimeout(r, 300));
    const [exportRow] = await app.db`
      SELECT record_count, chain_verified, pack_sha256 FROM audit_pack_exports
      WHERE id = ${packId}
    `;
    expect(exportRow).toBeTruthy();
    expect(Number(exportRow!.recordCount)).toBe(7);
    expect(exportRow!.chainVerified).toBe(true);
    expect(exportRow!.packSha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
