import { createHash } from 'node:crypto';
import { canonicalJson } from '../../shared/canonical-json.js';

/**
 * Tamper-evident per-tenant hash chain.
 *
 * record_hash = sha256(canonicalJson(hashable fields incl. prev_hash))
 * Genesis head (before any record) = sha256("TENET_GENESIS:" + tenant_id)
 *
 * Threat model (be honest with auditors): the chain detects modification or
 * deletion of historical records. It does NOT detect truncation by an actor
 * who can also rewrite tenant_chain_heads — mitigate by periodically anchoring
 * head hashes externally (roadmap).
 */

export interface HashableRecord {
  id: string;
  tenantId: string;
  seq: number;
  occurredAt: string; // ISO-8601 UTC
  modelId: string;
  modelVersion: string | null;
  promptVersion: string | null;
  systemPurpose: string | null;
  dataSources: unknown[];
  userConsent: boolean | null;
  consentRef: string | null;
  humanOversight: boolean;
  oversightActor: string | null;
  decisionOutput: unknown;
  inputSummary: unknown;
  riskTier: string | null;
  endUserRef: string | null;
  error: unknown;
  appeal: unknown;
  metadata: unknown;
  prevHash: string;
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function genesisHash(tenantId: string): string {
  return sha256Hex(`TENET_GENESIS:${tenantId}`);
}

export function computeRecordHash(record: HashableRecord): string {
  // Field list is the hashing contract — never reorder semantics, canonicalJson
  // sorts keys, so adding fields later changes hashes only for new records.
  return sha256Hex(
    canonicalJson({
      id: record.id,
      tenant_id: record.tenantId,
      seq: record.seq,
      occurred_at: record.occurredAt,
      model_id: record.modelId,
      model_version: record.modelVersion,
      prompt_version: record.promptVersion,
      system_purpose: record.systemPurpose,
      data_sources: record.dataSources,
      user_consent: record.userConsent,
      consent_ref: record.consentRef,
      human_oversight: record.humanOversight,
      oversight_actor: record.oversightActor,
      decision_output: record.decisionOutput,
      input_summary: record.inputSummary,
      risk_tier: record.riskTier,
      end_user_ref: record.endUserRef,
      error: record.error,
      appeal: record.appeal,
      metadata: record.metadata,
      prev_hash: record.prevHash,
    }),
  );
}

export interface StoredChainRecord extends HashableRecord {
  recordHash: string;
}

export interface ChainVerificationResult {
  valid: boolean;
  checkedRecords: number;
  firstInvalidSeq?: number;
  reason?: string;
}

/**
 * Verify a contiguous slice of a tenant chain, ordered by seq ascending.
 * `expectedPrevHash` is the hash the first record must link to (genesis hash
 * when starting from seq 1). `expectedHeadHash` optionally pins the final
 * record to the stored chain head.
 */
export function verifyChainSlice(
  records: StoredChainRecord[],
  expectedPrevHash: string,
  expectedHeadHash?: string,
): ChainVerificationResult {
  let prevHash = expectedPrevHash;
  let prevSeq: number | null = null;
  let checked = 0;

  for (const record of records) {
    if (prevSeq !== null && record.seq !== prevSeq + 1) {
      return {
        valid: false,
        checkedRecords: checked,
        firstInvalidSeq: record.seq,
        reason: `sequence gap: expected seq ${prevSeq + 1}, found ${record.seq}`,
      };
    }
    if (record.prevHash !== prevHash) {
      return {
        valid: false,
        checkedRecords: checked,
        firstInvalidSeq: record.seq,
        reason: 'prev_hash does not link to preceding record',
      };
    }
    const recomputed = computeRecordHash(record);
    if (recomputed !== record.recordHash) {
      return {
        valid: false,
        checkedRecords: checked,
        firstInvalidSeq: record.seq,
        reason: 'record content does not match stored record_hash (possible tampering)',
      };
    }
    prevHash = record.recordHash;
    prevSeq = record.seq;
    checked++;
  }

  if (expectedHeadHash !== undefined && prevHash !== expectedHeadHash) {
    return {
      valid: false,
      checkedRecords: checked,
      firstInvalidSeq: prevSeq ?? undefined,
      reason: 'final record hash does not match stored chain head',
    };
  }

  return { valid: true, checkedRecords: checked };
}
