import { describe, expect, it } from 'vitest';
import {
  computeRecordHash,
  genesisHash,
  verifyChainSlice,
  type HashableRecord,
  type StoredChainRecord,
} from '../../src/modules/ai-calls/hash-chain.js';

const TENANT = '01890000-0000-7000-8000-000000000001';

function makeRecord(seq: number, prevHash: string, overrides: Partial<HashableRecord> = {}): StoredChainRecord {
  const base: HashableRecord = {
    id: `01890000-0000-7000-8000-00000000000${seq}`,
    tenantId: TENANT,
    seq,
    occurredAt: '2026-06-11T10:00:00.000Z',
    modelId: 'claude-fable-5',
    modelVersion: '2026-01',
    promptVersion: 'v3',
    systemPurpose: 'cv-screening',
    dataSources: ['ats:applications'],
    userConsent: true,
    consentRef: 'consent-123',
    humanOversight: true,
    oversightActor: 'reviewer@example.com',
    decisionOutput: { decision: 'advance', score: 0.82 },
    inputSummary: { tokens: 1834 },
    riskTier: 'high',
    endUserRef: 'user-42',
    error: null,
    appeal: null,
    metadata: {},
    prevHash,
    ...overrides,
  };
  return { ...base, recordHash: computeRecordHash(base) };
}

function makeChain(length: number): StoredChainRecord[] {
  const records: StoredChainRecord[] = [];
  let prev = genesisHash(TENANT);
  for (let seq = 1; seq <= length; seq++) {
    const r = makeRecord(seq, prev);
    records.push(r);
    prev = r.recordHash;
  }
  return records;
}

describe('hash chain', () => {
  it('genesis hash is deterministic per tenant', () => {
    expect(genesisHash(TENANT)).toBe(genesisHash(TENANT));
    expect(genesisHash(TENANT)).not.toBe(genesisHash('01890000-0000-7000-8000-000000000002'));
  });

  it('record hash changes when any field changes', () => {
    const r = makeRecord(1, genesisHash(TENANT));
    const tampered = { ...r, decisionOutput: { decision: 'reject', score: 0.82 } };
    expect(computeRecordHash(tampered)).not.toBe(r.recordHash);
  });

  it('verifies an intact chain against genesis and head', () => {
    const chain = makeChain(10);
    const result = verifyChainSlice(chain, genesisHash(TENANT), chain[9]!.recordHash);
    expect(result).toEqual({ valid: true, checkedRecords: 10 });
  });

  it('detects content tampering and pinpoints the seq', () => {
    const chain = makeChain(10);
    chain[4] = { ...chain[4]!, humanOversight: false }; // tamper without rehashing
    const result = verifyChainSlice(chain, genesisHash(TENANT));
    expect(result.valid).toBe(false);
    expect(result.firstInvalidSeq).toBe(5);
    expect(result.reason).toContain('tampering');
  });

  it('detects a broken prev_hash link', () => {
    const chain = makeChain(5);
    const rebuilt = makeRecord(3, 'deadbeef'.repeat(8)); // valid self-hash, wrong link
    chain[2] = rebuilt;
    const result = verifyChainSlice(chain, genesisHash(TENANT));
    expect(result.valid).toBe(false);
    expect(result.firstInvalidSeq).toBe(3);
    expect(result.reason).toContain('prev_hash');
  });

  it('detects sequence gaps (deletion)', () => {
    const chain = makeChain(5);
    chain.splice(2, 1); // remove seq 3
    const result = verifyChainSlice(chain, genesisHash(TENANT));
    expect(result.valid).toBe(false);
    expect(result.firstInvalidSeq).toBe(4);
    expect(result.reason).toContain('gap');
  });

  it('detects head mismatch (truncation with stale head)', () => {
    const chain = makeChain(5);
    const truncated = chain.slice(0, 4);
    const result = verifyChainSlice(truncated, genesisHash(TENANT), chain[4]!.recordHash);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('chain head');
  });
});
