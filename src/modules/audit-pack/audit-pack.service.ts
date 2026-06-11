import { uuidv7 } from 'uuidv7';
import type { Sql } from '../../db/client.js';
import type { FastifyBaseLogger } from 'fastify';
import { notFound } from '../../shared/errors.js';
import { genesisHash } from '../ai-calls/hash-chain.js';
import { rowToApi } from '../ai-calls/ai-calls.service.js';
import { rowToApi as incidentToApi } from '../incidents/incidents.service.js';
import { verifyTenantChain } from '../verification/verification.service.js';
import { renderPdfSummary, type PackStats } from './pdf-summary.js';
import { createZipBuilder } from './zip-builder.js';

const RECORDS_PER_FILE = 5000;

export interface AuditPackOptions {
  from: string;
  to: string;
  includeIncidents: boolean;
}

export interface AuditPackResult {
  packId: string;
  filename: string;
  stream: NodeJS.ReadableStream;
}

export async function buildAuditPack(
  sql: Sql,
  log: FastifyBaseLogger,
  tenantId: string,
  opts: AuditPackOptions,
): Promise<AuditPackResult> {
  const [tenant] = await sql<{ name: string; slug: string }[]>`
    SELECT name, slug FROM tenants WHERE id = ${tenantId}
  `;
  if (!tenant) throw notFound('Tenant not found');

  const packId = uuidv7();
  const generatedAt = new Date().toISOString();

  // Gather everything that goes into the PDF before streaming starts, so any
  // failure here becomes a clean HTTP error instead of a broken download.
  const stats = await collectStats(sql, tenantId, opts);
  const verification = await verifyTenantChain(sql, tenantId);
  const riskRows = await sql`
    SELECT system_name, tier, created_at FROM risk_assessments
    WHERE tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT 25
  `;
  const incidentRows = opts.includeIncidents
    ? await sql`
        SELECT * FROM incidents
        WHERE tenant_id = ${tenantId} AND occurred_at BETWEEN ${opts.from} AND ${opts.to}
        ORDER BY occurred_at ASC
      `
    : [];
  const incidents = incidentRows.map(incidentToApi);

  const pdf = await renderPdfSummary({
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    packId,
    rangeFrom: opts.from,
    rangeTo: opts.to,
    generatedAt,
    stats,
    verification,
    genesisHash: genesisHash(tenantId),
    riskAssessments: riskRows.map((r) => ({
      system_name: r.systemName as string,
      tier: r.tier as string,
      created_at: (r.createdAt as Date).toISOString(),
    })),
    incidents,
  });

  const zip = createZipBuilder();

  // Build asynchronously while the caller streams the response.
  const build = async () => {
    zip.addFile('audit-pack/summary.pdf', pdf);

    let fileIndex = 0;
    let lastSeq = 0;
    let totalRecords = 0;
    for (;;) {
      const rows = await sql`
        SELECT * FROM ai_call_logs
        WHERE tenant_id = ${tenantId}
          AND occurred_at BETWEEN ${opts.from} AND ${opts.to}
          AND seq > ${lastSeq}
        ORDER BY seq ASC
        LIMIT ${RECORDS_PER_FILE}
      `;
      if (rows.length === 0) break;
      fileIndex += 1;
      totalRecords += rows.length;
      lastSeq = Number(rows[rows.length - 1]!.seq);
      const records = rows.map(rowToApi);
      zip.addFile(
        `audit-pack/evidence/ai-calls-${String(fileIndex).padStart(4, '0')}.json`,
        JSON.stringify({ pack_id: packId, file: fileIndex, records }, null, 2),
      );
      if (rows.length < RECORDS_PER_FILE) break;
    }

    const assessments = await sql`
      SELECT * FROM risk_assessments WHERE tenant_id = ${tenantId} ORDER BY created_at ASC
    `;
    zip.addFile(
      'audit-pack/evidence/risk-assessments.json',
      JSON.stringify(
        assessments.map((r) => ({
          id: r.id,
          created_at: (r.createdAt as Date).toISOString(),
          system_name: r.systemName,
          input: r.input,
          tier: r.tier,
          confidence: r.confidence,
          matched_rules: r.matchedRules,
          obligations: r.obligations,
        })),
        null,
        2,
      ),
    );
    zip.addFile('audit-pack/evidence/incidents.json', JSON.stringify(incidents, null, 2));
    zip.addFile(
      'audit-pack/chain-verification.json',
      JSON.stringify(
        {
          verified_at: generatedAt,
          valid: verification.valid,
          checked_records: verification.checkedRecords,
          first_invalid_seq: verification.firstInvalidSeq ?? null,
          reason: verification.reason ?? null,
          head_seq: verification.headSeq,
          head_hash: verification.headHash,
          genesis_hash: genesisHash(tenantId),
        },
        null,
        2,
      ),
    );

    await zip.finalize({
      pack_id: packId,
      tenant: tenant.slug,
      range_from: opts.from,
      range_to: opts.to,
      generated_at: generatedAt,
      chain_verified: verification.valid,
      head_hash: verification.headHash,
      record_count: totalRecords,
    });

    // Provenance row once the consumer has fully read the pack.
    const packSha256 = await zip.completed;
    await sql`
      INSERT INTO audit_pack_exports
        (id, tenant_id, range_from, range_to, record_count, chain_verified, pack_sha256)
      VALUES
        (${packId}, ${tenantId}, ${opts.from}, ${opts.to}, ${totalRecords},
         ${verification.valid}, ${packSha256})
    `;
  };

  build().catch((err) => {
    log.error({ err, packId }, 'audit pack build failed');
    zip.abort(err instanceof Error ? err : new Error(String(err)));
  });

  const filename = `audit-pack-${tenant.slug}-${opts.from.slice(0, 10)}-${opts.to.slice(0, 10)}.zip`;
  return { packId, filename, stream: zip.stream };
}

async function collectStats(
  sql: Sql,
  tenantId: string,
  opts: AuditPackOptions,
): Promise<PackStats> {
  const [agg] = await sql<
    {
      total: string;
      oversight: string;
      consent: string;
      errors: string;
      appeals: string;
    }[]
  >`
    SELECT
      count(*) AS total,
      count(*) FILTER (WHERE human_oversight) AS oversight,
      count(*) FILTER (WHERE user_consent IS NOT NULL) AS consent,
      count(*) FILTER (WHERE error IS NOT NULL) AS errors,
      count(*) FILTER (WHERE appeal IS NOT NULL) AS appeals
    FROM ai_call_logs
    WHERE tenant_id = ${tenantId} AND occurred_at BETWEEN ${opts.from} AND ${opts.to}
  `;
  const byModel = await sql<{ modelId: string; count: string }[]>`
    SELECT model_id, count(*) AS count FROM ai_call_logs
    WHERE tenant_id = ${tenantId} AND occurred_at BETWEEN ${opts.from} AND ${opts.to}
    GROUP BY model_id ORDER BY count(*) DESC
  `;
  return {
    totalCalls: Number(agg!.total),
    oversightCount: Number(agg!.oversight),
    consentRecordedCount: Number(agg!.consent),
    errorCount: Number(agg!.errors),
    appealCount: Number(agg!.appeals),
    byModel: byModel.map((m) => ({ modelId: m.modelId, count: Number(m.count) })),
  };
}
