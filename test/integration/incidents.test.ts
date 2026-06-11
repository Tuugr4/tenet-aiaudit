import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, seedTenant } from '../helpers/build-test-app.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

describe('incidents', () => {
  it('auto-flags serious incidents as Article 73 with a reporting note', async () => {
    const t = await seedTenant(app, 'inc');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/incident-report',
      headers: authHeader(t.apiKey),
      payload: {
        occurred_at: '2026-06-01T12:00:00Z',
        severity: 'serious',
        title: 'Discriminatory screening output',
        description: 'Model systematically rejected candidates from a protected group.',
        affected_users: 124,
      },
    });
    expect(res.statusCode).toBe(201);
    const incident = res.json();
    expect(incident.is_article_73).toBe(true);
    expect(incident.article_73_note).toContain('15 days');
    expect(incident.status).toBe('open');
  });

  it('minor incidents are not Article 73 by default', async () => {
    const t = await seedTenant(app, 'inc2');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/incident-report',
      headers: authHeader(t.apiKey),
      payload: {
        occurred_at: '2026-06-02T12:00:00Z',
        severity: 'minor',
        title: 'Latency spike',
        description: 'Responses delayed.',
      },
    });
    expect(res.json().is_article_73).toBe(false);
  });

  it('supports lifecycle updates via PATCH', async () => {
    const t = await seedTenant(app, 'inc3');
    const created = await app.inject({
      method: 'POST',
      url: '/v1/incident-report',
      headers: authHeader(t.apiKey),
      payload: {
        occurred_at: '2026-06-03T12:00:00Z',
        severity: 'major',
        title: 'Wrong decisions',
        description: 'Bad model rollout.',
      },
    });
    const id = created.json().id;

    const patched = await app.inject({
      method: 'PATCH',
      url: `/v1/incidents/${id}`,
      headers: authHeader(t.apiKey),
      payload: {
        status: 'remediated',
        remediation: { actions: ['rolled back model'], status: 'done' },
        reported_to_authority: true,
        authority_ref: 'MSA-2026-0042',
      },
    });
    expect(patched.statusCode).toBe(200);
    const incident = patched.json();
    expect(incident.status).toBe('remediated');
    expect(incident.reported_to_authority).toBe(true);
    expect(incident.authority_ref).toBe('MSA-2026-0042');
  });

  it('filters by severity and status', async () => {
    const t = await seedTenant(app, 'inc4');
    for (const severity of ['serious', 'major', 'minor'] as const) {
      await app.inject({
        method: 'POST',
        url: '/v1/incident-report',
        headers: authHeader(t.apiKey),
        payload: {
          occurred_at: '2026-06-04T12:00:00Z',
          severity,
          title: `${severity} incident`,
          description: 'x',
        },
      });
    }
    const serious = await app.inject({
      method: 'GET',
      url: '/v1/incidents?severity=serious',
      headers: authHeader(t.apiKey),
    });
    expect(serious.json()).toHaveLength(1);
    const open = await app.inject({
      method: 'GET',
      url: '/v1/incidents?status=open',
      headers: authHeader(t.apiKey),
    });
    expect(open.json()).toHaveLength(3);
  });
});

describe('risk-classify persistence', () => {
  it('persists assessments and lists them', async () => {
    const t = await seedTenant(app, 'risk');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/risk-classify',
      headers: authHeader(t.apiKey),
      payload: {
        system_name: 'TalentMatch',
        description: 'CV screening',
        questionnaire: { domain: 'employment', recruitment_or_screening: true },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().tier).toBe('high');
    expect(res.json().assessment_id).toBeTruthy();

    const list = await app.inject({
      method: 'GET',
      url: '/v1/risk-assessments',
      headers: authHeader(t.apiKey),
    });
    expect(list.json()).toHaveLength(1);
    expect(list.json()[0].tier).toBe('high');
  });

  it('persist=false skips storage', async () => {
    const t = await seedTenant(app, 'risk2');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/risk-classify',
      headers: authHeader(t.apiKey),
      payload: { system_name: 'Scratch', description: 'just exploring', persist: false },
    });
    expect(res.json().assessment_id).toBeNull();
    const list = await app.inject({
      method: 'GET',
      url: '/v1/risk-assessments',
      headers: authHeader(t.apiKey),
    });
    expect(list.json()).toHaveLength(0);
  });
});
