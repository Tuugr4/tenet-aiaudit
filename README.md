# Tenet Audit

Self-hosted audit logging for AI systems. Logs every AI/LLM call your product makes into a tamper-evident hash chain, classifies systems against EU AI Act risk tiers, tracks incidents, and exports evidence packs you can hand to an auditor.

EU AI Act transparency obligations (Article 50) apply from 2 August 2026. High-risk systems already carry record-keeping, human-oversight and incident-reporting duties. This service is the record-keeping side of that problem.

## What maps to what

| Feature | Regulation (EU) 2024/1689 |
|---|---|
| `POST /v1/log-ai-call` — append-only, hash-chained AI call records (model & prompt version, data sources, consent, oversight, decision, errors, appeals) | Article 12 record-keeping |
| `human_oversight` / `oversight_actor` fields, oversight stats in audit packs | Article 14 human oversight |
| `POST /v1/risk-classify` — rules engine over Article 5 prohibitions, Annex III high-risk categories and Article 50 transparency cases, returns an obligations checklist | Article 6 / Annex III / Article 5 / Article 50 |
| `POST /v1/incident-report` — serious incidents auto-flagged, 15-day reporting guidance | Article 73 serious incident reporting |
| `GET /v1/export-audit-pack` — ZIP with PDF summary, JSON evidence and chain verification | Evidence for all of the above |
| `GET /v1/verify-chain` — integrity verification of the record chain | Supports Article 12 evidentiary value |

## Quickstart

```bash
cp .env.example .env
docker compose up -d            # postgres + migrations + app on :3000
docker compose run --rm app npx tsx scripts/create-admin-key.ts   # prints ta_admin_… once
```

Local development (Postgres from compose on host port 5433):

```bash
npm install
docker compose up -d postgres
npm run migrate:up
npm run bootstrap               # create admin key
npm run dev                     # server on :3000
npm run seed:demo               # demo tenant + 40 sample calls + incident
```

Interactive docs: `http://localhost:3000/docs`. OpenAPI: `/openapi.json` (snapshot in `openapi/`).

### Create a tenant (admin key)

```bash
curl -X POST http://localhost:3000/v1/admin/tenants \
  -H "Authorization: Bearer ta_admin_…" -H "Content-Type: application/json" \
  -d '{"name":"Acme HR","slug":"acme-hr"}'
# returns the tenant, a ta_live_… API key (shown once) and the genesis hash
```

### Log an AI call (tenant key)

```bash
curl -X POST http://localhost:3000/v1/log-ai-call \
  -H "Authorization: Bearer ta_live_…" -H "Content-Type: application/json" \
  -d '{
    "occurred_at": "2026-06-11T10:00:00Z",
    "model_id": "claude-fable-5",
    "model_version": "2026-01",
    "prompt_version": "cv-screen-v3",
    "system_purpose": "cv-screening",
    "data_sources": ["ats:applications"],
    "user_consent": true,
    "human_oversight": true,
    "oversight_actor": "hr-reviewer@acme.example",
    "decision_output": {"decision": "advance", "score": 0.82},
    "risk_tier": "high",
    "end_user_ref": "candidate-7421"
  }'
# {"id":"…","seq":1,"record_hash":"…","prev_hash":"…","recorded_at":"…"}
```

The response is a receipt: if you store `seq` and `record_hash` on your side, you can later prove the record was not altered, even by the log server itself.

For high volume use `POST /v1/log-ai-call/batch` (up to 500 records, one chain lock).

### Classify a system, report an incident, export evidence

```bash
curl -X POST http://localhost:3000/v1/risk-classify -H "Authorization: Bearer ta_live_…" \
  -H "Content-Type: application/json" \
  -d '{"system_name":"TalentMatch","description":"Screens CVs","questionnaire":{"domain":"employment","recruitment_or_screening":true}}'

curl -X POST http://localhost:3000/v1/incident-report -H "Authorization: Bearer ta_live_…" \
  -H "Content-Type: application/json" \
  -d '{"occurred_at":"2026-06-10T09:00:00Z","severity":"serious","title":"Bias detected","description":"…","affected_users":87}'

curl -H "Authorization: Bearer ta_live_…" \
  "http://localhost:3000/v1/export-audit-pack?from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z" \
  -o audit-pack.zip
```

The audit pack contains `summary.pdf` (verification status, summary stats, Article 12 methodology statement, risk summary, incident register), chunked JSON evidence files, `chain-verification.json`, and a `manifest.json` with per-file SHA-256 hashes. The SHA-256 of the pack itself is recorded server-side in `audit_pack_exports`.

## How the hash chain works

- Every tenant has its own chain. The head starts at `sha256("TENET_GENESIS:" + tenant_id)`.
- Each record stores `prev_hash` (the previous record's hash) and `record_hash = sha256(canonicalJson(all fields incl. prev_hash))`. Canonical JSON means recursively key-sorted, no whitespace, ISO-8601 UTC millisecond timestamps. `src/shared/canonical-json.ts` is the contract.
- Appends are serialized per tenant by `SELECT … FOR UPDATE` on `tenant_chain_heads`; different tenants append concurrently.
- `GET /v1/verify-chain` recomputes every hash, checks linkage and sequence gaps, and pins the final record to the stored head. On failure it reports the exact `first_invalid_seq`.

### Threat model

The chain detects modification, deletion and reordering of historical records, including by someone with plain SQL write access. It does not detect truncation by an actor who can also rewrite the chain head row. Mitigation (planned): periodically anchor head hashes to external storage such as write-once object storage or a customer-held ledger. The genesis and head hashes are printed in every audit pack so third parties can pin them.

## Risk classification: scope and limits

The engine is deterministic and rules-based, no LLM involved: every classification is reproducible and explainable. Structured questionnaire answers are authoritative (`confidence: "high"`); free-text keyword matches are only a screening aid (`confidence: "indicative"`). It is not legal advice, and every response says so.

## Architecture

Fastify v5 + TypeBox (validation and OpenAPI from one schema source), PostgreSQL 16 (`postgres` driver, JSONB payloads), node-pg-migrate, pdfkit + archiver (streaming ZIP, no temp files), pino with payload redaction (AI decision outputs are never written to server logs). API keys are stored as SHA-256 with per-key rate limiting. Tenant isolation is enforced in the service layer: every query takes `tenant_id` from the authenticated key, never from the payload.

```
src/
├── app.ts                 # buildApp() with injectable config/db, used by tests
├── plugins/               # auth, rate-limit, swagger, RFC 7807 errors
├── modules/
│   ├── tenants/           # admin: tenants + API keys
│   ├── ai-calls/          # ingestion + hash-chain.ts
│   ├── risk/              # rules/{article-5,annex-iii,article-50,obligations}.ts
│   ├── incidents/
│   ├── audit-pack/        # pdf-summary.ts + zip-builder.ts
│   └── verification/      # verify-chain
└── shared/                # canonical-json.ts (hashing contract), errors
```

## Tests

```bash
npm run test:unit          # canonical JSON, hash chain, risk rules, key handling
docker compose up -d postgres && npm run migrate:up
npm run test:integration   # concurrency, tenancy isolation, tamper detection, ZIP/PDF round-trip
```

Covered cases include: 50 parallel appends produce a gapless verified chain; raw-SQL tampering is pinpointed to the exact `seq`; the exported ZIP is unzipped in-test and every manifest hash re-checked.

## License & disclaimer

Apache-2.0. This project produces supporting evidence for EU AI Act compliance. It is not a conformity assessment, certification, or legal advice.
