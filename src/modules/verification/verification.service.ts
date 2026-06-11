import type { Sql } from '../../db/client.js';
import {
  genesisHash,
  verifyChainSlice,
  type ChainVerificationResult,
  type StoredChainRecord,
} from '../ai-calls/hash-chain.js';
import { badRequest, notFound } from '../../shared/errors.js';

const CHUNK = 1000;

export interface VerifyOptions {
  fromSeq?: number;
  toSeq?: number;
}

export interface VerifyResult extends ChainVerificationResult {
  fromSeq: number;
  toSeq: number;
  headSeq: number;
  headHash: string;
}

export async function verifyTenantChain(
  sql: Sql,
  tenantId: string,
  opts: VerifyOptions = {},
): Promise<VerifyResult> {
  const heads = await sql<{ seq: string; headHash: string }[]>`
    SELECT seq, head_hash FROM tenant_chain_heads WHERE tenant_id = ${tenantId}
  `;
  const head = heads[0];
  if (!head) throw notFound('Chain head missing for tenant');
  const headSeq = Number(head.seq);

  const fromSeq = opts.fromSeq ?? 1;
  const toSeq = opts.toSeq ?? headSeq;

  if (headSeq === 0) {
    return {
      valid: true,
      checkedRecords: 0,
      fromSeq,
      toSeq: 0,
      headSeq,
      headHash: head.headHash,
    };
  }
  if (fromSeq < 1 || toSeq < fromSeq) throw badRequest('Invalid seq range');

  // Anchor: genesis when starting at seq 1, else the prior record's hash.
  let expectedPrevHash: string;
  if (fromSeq === 1) {
    expectedPrevHash = genesisHash(tenantId);
  } else {
    const prior = await sql<{ recordHash: string }[]>`
      SELECT record_hash FROM ai_call_logs
      WHERE tenant_id = ${tenantId} AND seq = ${fromSeq - 1}
    `;
    if (!prior[0]) throw badRequest(`Record at seq ${fromSeq - 1} not found to anchor range`);
    expectedPrevHash = prior[0].recordHash;
  }

  let checkedTotal = 0;
  let cursor = fromSeq;
  while (cursor <= toSeq) {
    const upper = Math.min(cursor + CHUNK - 1, toSeq);
    const rows = await sql`
      SELECT * FROM ai_call_logs
      WHERE tenant_id = ${tenantId} AND seq BETWEEN ${cursor} AND ${upper}
      ORDER BY seq ASC
    `;
    const records: StoredChainRecord[] = rows.map((row) => ({
      id: row.id as string,
      tenantId: row.tenantId as string,
      seq: Number(row.seq),
      occurredAt: (row.occurredAt as Date).toISOString(),
      modelId: row.modelId as string,
      modelVersion: row.modelVersion ?? null,
      promptVersion: row.promptVersion ?? null,
      systemPurpose: row.systemPurpose ?? null,
      dataSources: (row.dataSources as unknown[]) ?? [],
      userConsent: row.userConsent ?? null,
      consentRef: row.consentRef ?? null,
      humanOversight: row.humanOversight as boolean,
      oversightActor: row.oversightActor ?? null,
      decisionOutput: row.decisionOutput ?? null,
      inputSummary: row.inputSummary ?? null,
      riskTier: row.riskTier ?? null,
      endUserRef: row.endUserRef ?? null,
      error: row.error ?? null,
      appeal: row.appeal ?? null,
      metadata: row.metadata ?? {},
      prevHash: row.prevHash as string,
      recordHash: row.recordHash as string,
    }));

    if (records.length !== upper - cursor + 1) {
      // Find the first missing seq for a precise report.
      const present = new Set(records.map((r) => r.seq));
      let missing = cursor;
      while (present.has(missing)) missing++;
      return {
        valid: false,
        checkedRecords: checkedTotal,
        firstInvalidSeq: missing,
        reason: `record at seq ${missing} is missing (possible deletion)`,
        fromSeq,
        toSeq,
        headSeq,
        headHash: head.headHash,
      };
    }

    const pinHead = upper === headSeq ? head.headHash : undefined;
    const result = verifyChainSlice(records, expectedPrevHash, pinHead);
    checkedTotal += result.checkedRecords;
    if (!result.valid) {
      return { ...result, checkedRecords: checkedTotal, fromSeq, toSeq, headSeq, headHash: head.headHash };
    }
    expectedPrevHash = records[records.length - 1]!.recordHash;
    cursor = upper + 1;
  }

  return {
    valid: true,
    checkedRecords: checkedTotal,
    fromSeq,
    toSeq,
    headSeq,
    headHash: head.headHash,
  };
}
