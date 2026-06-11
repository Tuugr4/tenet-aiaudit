import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { loadConfig, type Config } from '../../src/config.js';
import { createTenant } from '../../src/modules/tenants/tenants.service.js';
import { generateApiKey } from '../../src/plugins/auth.js';
import { uuidv7 } from 'uuidv7';

export const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://tenet:tenet@localhost:5433/tenet_audit';

export async function buildTestApp(overrides: Partial<Config> = {}): Promise<FastifyInstance> {
  const config = loadConfig({
    DATABASE_URL: TEST_DATABASE_URL,
    LOG_LEVEL: 'silent',
    ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, String(v)])),
  });
  return buildApp({ config });
}

let counter = 0;

/** Create a fresh tenant with a unique slug and return its API key secret. */
export async function seedTenant(app: FastifyInstance, namePrefix = 'test') {
  counter += 1;
  const slug = `${namePrefix}-${Date.now()}-${counter}`.toLowerCase();
  const result = await createTenant(app.db, `${namePrefix} tenant`, slug);
  return {
    tenantId: result.tenant.id,
    slug,
    apiKey: result.apiKey.secret,
    genesisHash: result.genesisHash,
  };
}

/** Insert an admin key directly and return its secret. */
export async function seedAdminKey(app: FastifyInstance) {
  const key = generateApiKey('admin');
  const id = uuidv7();
  await app.db`
    INSERT INTO api_keys (id, tenant_id, key_hash, key_prefix, role, label)
    VALUES (${id}, NULL, ${key.keyHash}, ${key.keyPrefix}, 'admin', 'test admin')
  `;
  return key.secret;
}

export function authHeader(secret: string) {
  return { authorization: `Bearer ${secret}` };
}

export function sampleCall(overrides: Record<string, unknown> = {}) {
  return {
    occurred_at: new Date().toISOString(),
    model_id: 'claude-fable-5',
    model_version: '2026-01',
    prompt_version: 'v1',
    system_purpose: 'cv-screening',
    data_sources: ['ats:applications'],
    user_consent: true,
    consent_ref: 'consent-1',
    human_oversight: true,
    oversight_actor: 'reviewer@example.com',
    decision_output: { decision: 'advance', score: 0.8 },
    risk_tier: 'high',
    end_user_ref: 'candidate-1',
    ...overrides,
  };
}
