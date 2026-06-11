/** Seed a demo tenant with sample data. Usage: npm run seed:demo */
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db/client.js';
import { createTenant } from '../src/modules/tenants/tenants.service.js';
import { appendAiCalls } from '../src/modules/ai-calls/ai-calls.service.js';
import { classifyAndPersist } from '../src/modules/risk/risk.service.js';
import { createIncident } from '../src/modules/incidents/incidents.service.js';

const config = loadConfig();
const sql = createDb(config.DATABASE_URL);

const slug = `demo-${Date.now()}`;
const { tenant, apiKey, genesisHash } = await createTenant(sql, 'Demo HR Tech GmbH', slug);
console.log(`Tenant: ${tenant.name} (${slug})`);
console.log(`API key (shown once): ${apiKey.secret}`);
console.log(`Genesis hash: ${genesisHash}\n`);

const models = ['claude-fable-5', 'gpt-5', 'claude-haiku-4-5'];
const records = Array.from({ length: 40 }, (_, i) => ({
  occurred_at: new Date(Date.now() - (40 - i) * 3_600_000).toISOString(),
  model_id: models[i % models.length]!,
  model_version: '2026-01',
  prompt_version: `v${(i % 3) + 1}`,
  system_purpose: 'cv-screening',
  data_sources: ['ats:applications', 'cv:upload'],
  user_consent: true,
  consent_ref: `consent-${i}`,
  human_oversight: i % 4 !== 0,
  oversight_actor: i % 4 !== 0 ? 'hr-reviewer@demo.example' : undefined,
  decision_output: { decision: i % 5 === 0 ? 'reject' : 'advance', score: 0.5 + (i % 50) / 100 },
  risk_tier: 'high',
  end_user_ref: `candidate-${i}`,
  error: i === 13 ? { code: 'timeout', message: 'model timeout' } : undefined,
}));
const receipts = await appendAiCalls(sql, tenant.id, records);
console.log(`Appended ${receipts.length} AI call records (head: ${receipts.at(-1)!.record_hash})`);

const risk = await classifyAndPersist(
  sql,
  tenant.id,
  {
    system_name: 'TalentMatch CV Screener',
    description: 'Screens and ranks CVs of applicants for client companies.',
    questionnaire: { domain: 'employment', recruitment_or_screening: true },
  },
  true,
);
console.log(`Risk assessment: ${risk.tier} (${risk.confidence})`);

const incident = await createIncident(sql, tenant.id, {
  occurred_at: new Date(Date.now() - 20 * 3_600_000).toISOString(),
  severity: 'serious',
  title: 'Potential bias in screening output',
  description: 'Statistical review showed lower advance rates for one demographic group.',
  affected_users: 87,
  remediation: { actions: ['model rollback', 'manual re-review of affected candidates'] },
});
console.log(`Incident logged: ${incident.id} (Article 73: ${incident.is_article_73})`);

console.log('\nTry it:');
console.log(`  curl -H "Authorization: Bearer ${apiKey.secret}" "http://localhost:3000/v1/verify-chain"`);
console.log(`  curl -H "Authorization: Bearer ${apiKey.secret}" "http://localhost:3000/v1/export-audit-pack?from=2026-01-01T00:00:00Z&to=2027-01-01T00:00:00Z" -o audit-pack.zip`);

await sql.end();
