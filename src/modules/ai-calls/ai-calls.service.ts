import { uuidv7 } from 'uuidv7';
import type { Sql } from '../../db/client.js';
import { computeRecordHash, type HashableRecord } from './hash-chain.js';
import { notFound } from '../../shared/errors.js';

export interface LogAiCallInput {
  occurred_at: string;
  model_id: string;
  model_version?: string;
  prompt_version?: string;
  system_purpose?: string;
  data_sources?: string[];
  user_consent?: boolean;
  consent_ref?: string;
  human_oversight: boolean;
  oversight_actor?: string;
  decision_output?: unknown;
  input_summary?: unknown;
  risk_tier?: string;
  end_user_ref?: string;
  error?: unknown;
  appeal?: unknown;
  metadata?: Record<string, unknown>;
}

export interface Receipt {
  id: string;
  seq: number;
  record_hash: string;
  prev_hash: string;
  recorded_at: string;
}

/**
 * Append records to a tenant's hash chain. One transaction: the FOR UPDATE on
 * tenant_chain_heads serializes appends per tenant while keeping tenants
 * concurrent with each other. Batch = one lock acquisition for N records.
 */
export async function appendAiCalls(
  sql: Sql,
  tenantId: string,
  inputs: LogAiCallInput[],
): Promise<Receipt[]> {
  return sql.begin(async (tx) => {
    const heads = await tx<{ seq: string; headHash: string }[]>`
      SELECT seq, head_hash FROM tenant_chain_heads
      WHERE tenant_id = ${tenantId}
      FOR UPDATE
    `;
    const head = heads[0];
    if (!head) throw notFound('Chain head missing for tenant');

    let seq = Number(head.seq);
    let prevHash = head.headHash;
    const receipts: Receipt[] = [];

    for (const input of inputs) {
      seq += 1;
      const id = uuidv7();
      const record: HashableRecord = {
        id,
        tenantId,
        seq,
        // Normalize to ISO-8601 UTC ms — part of the hashing contract.
        occurredAt: new Date(input.occurred_at).toISOString(),
        modelId: input.model_id,
        modelVersion: input.model_version ?? null,
        promptVersion: input.prompt_version ?? null,
        systemPurpose: input.system_purpose ?? null,
        dataSources: input.data_sources ?? [],
        userConsent: input.user_consent ?? null,
        consentRef: input.consent_ref ?? null,
        humanOversight: input.human_oversight,
        oversightActor: input.oversight_actor ?? null,
        decisionOutput: input.decision_output ?? null,
        inputSummary: input.input_summary ?? null,
        riskTier: input.risk_tier ?? null,
        endUserRef: input.end_user_ref ?? null,
        error: input.error ?? null,
        appeal: input.appeal ?? null,
        metadata: input.metadata ?? {},
        prevHash,
      };
      const recordHash = computeRecordHash(record);

      const [inserted] = await tx<{ recordedAt: Date }[]>`
        INSERT INTO ai_call_logs (
          id, tenant_id, seq, occurred_at, model_id, model_version, prompt_version,
          system_purpose, data_sources, user_consent, consent_ref, human_oversight,
          oversight_actor, decision_output, input_summary, risk_tier, end_user_ref,
          error, appeal, metadata, prev_hash, record_hash
        ) VALUES (
          ${id}, ${tenantId}, ${seq}, ${record.occurredAt}, ${record.modelId},
          ${record.modelVersion}, ${record.promptVersion}, ${record.systemPurpose},
          ${tx.json(record.dataSources as never)}, ${record.userConsent}, ${record.consentRef},
          ${record.humanOversight}, ${record.oversightActor},
          ${record.decisionOutput === null ? null : tx.json(record.decisionOutput as never)},
          ${record.inputSummary === null ? null : tx.json(record.inputSummary as never)},
          ${record.riskTier}, ${record.endUserRef},
          ${record.error === null ? null : tx.json(record.error as never)},
          ${record.appeal === null ? null : tx.json(record.appeal as never)},
          ${tx.json(record.metadata as never)}, ${prevHash}, ${recordHash}
        )
        RETURNING recorded_at
      `;

      receipts.push({
        id,
        seq,
        record_hash: recordHash,
        prev_hash: prevHash,
        recorded_at: inserted!.recordedAt.toISOString(),
      });
      prevHash = recordHash;
    }

    await tx`
      UPDATE tenant_chain_heads SET seq = ${seq}, head_hash = ${prevHash}
      WHERE tenant_id = ${tenantId}
    `;
    return receipts;
  }) as Promise<Receipt[]>;
}

export interface ListFilters {
  from?: string;
  to?: string;
  model_id?: string;
  system_purpose?: string;
  risk_tier?: string;
  human_oversight?: boolean;
  has_error?: boolean;
  end_user_ref?: string;
  cursor?: number;
  limit?: number;
}

export async function listAiCalls(sql: Sql, tenantId: string, f: ListFilters) {
  const limit = f.limit ?? 50;
  const rows = await sql`
    SELECT * FROM ai_call_logs
    WHERE tenant_id = ${tenantId}
      ${f.from ? sql`AND occurred_at >= ${f.from}` : sql``}
      ${f.to ? sql`AND occurred_at <= ${f.to}` : sql``}
      ${f.model_id ? sql`AND model_id = ${f.model_id}` : sql``}
      ${f.system_purpose ? sql`AND system_purpose = ${f.system_purpose}` : sql``}
      ${f.risk_tier ? sql`AND risk_tier = ${f.risk_tier}` : sql``}
      ${f.human_oversight !== undefined ? sql`AND human_oversight = ${f.human_oversight}` : sql``}
      ${f.has_error !== undefined ? (f.has_error ? sql`AND error IS NOT NULL` : sql`AND error IS NULL`) : sql``}
      ${f.end_user_ref ? sql`AND end_user_ref = ${f.end_user_ref}` : sql``}
      ${f.cursor !== undefined ? sql`AND seq < ${f.cursor}` : sql``}
    ORDER BY seq DESC
    LIMIT ${limit}
  `;
  const items = rows.map(rowToApi);
  const last = items[items.length - 1];
  return {
    items,
    next_cursor: items.length === limit && last ? last.seq : null,
  };
}

export async function getAiCall(sql: Sql, tenantId: string, id: string) {
  const rows = await sql`
    SELECT * FROM ai_call_logs
    WHERE tenant_id = ${tenantId} AND id = ${id}
  `;
  if (rows.length === 0) throw notFound('AI call record not found');
  return rowToApi(rows[0]!);
}

/** Map a camelCase DB row to the snake_case API shape. */
export function rowToApi(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    seq: Number(row.seq),
    occurred_at: (row.occurredAt as Date).toISOString(),
    recorded_at: (row.recordedAt as Date).toISOString(),
    model_id: row.modelId as string,
    model_version: (row.modelVersion as string | null) ?? null,
    prompt_version: (row.promptVersion as string | null) ?? null,
    system_purpose: (row.systemPurpose as string | null) ?? null,
    data_sources: (row.dataSources as string[]) ?? [],
    user_consent: (row.userConsent as boolean | null) ?? null,
    consent_ref: (row.consentRef as string | null) ?? null,
    human_oversight: row.humanOversight as boolean,
    oversight_actor: (row.oversightActor as string | null) ?? null,
    decision_output: row.decisionOutput ?? null,
    input_summary: row.inputSummary ?? null,
    risk_tier: (row.riskTier as string | null) ?? null,
    end_user_ref: (row.endUserRef as string | null) ?? null,
    error: row.error ?? null,
    appeal: row.appeal ?? null,
    metadata: row.metadata ?? {},
    prev_hash: row.prevHash as string,
    record_hash: row.recordHash as string,
  };
}
