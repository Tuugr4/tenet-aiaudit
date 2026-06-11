/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE tenants (
      id          UUID PRIMARY KEY,
      name        TEXT NOT NULL,
      slug        TEXT NOT NULL UNIQUE,
      status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE api_keys (
      id            UUID PRIMARY KEY,
      tenant_id     UUID REFERENCES tenants(id),
      key_hash      TEXT NOT NULL UNIQUE,
      key_prefix    TEXT NOT NULL,
      role          TEXT NOT NULL CHECK (role IN ('admin','tenant')),
      label         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      revoked_at    TIMESTAMPTZ,
      last_used_at  TIMESTAMPTZ,
      CHECK ((role = 'admin') = (tenant_id IS NULL))
    );
    CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id) WHERE revoked_at IS NULL;

    CREATE TABLE tenant_chain_heads (
      tenant_id  UUID PRIMARY KEY REFERENCES tenants(id),
      seq        BIGINT NOT NULL DEFAULT 0,
      head_hash  TEXT NOT NULL
    );

    CREATE TABLE ai_call_logs (
      id              UUID PRIMARY KEY,
      tenant_id       UUID NOT NULL REFERENCES tenants(id),
      seq             BIGINT NOT NULL,
      occurred_at     TIMESTAMPTZ NOT NULL,
      recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      model_id        TEXT NOT NULL,
      model_version   TEXT,
      prompt_version  TEXT,
      system_purpose  TEXT,
      data_sources    JSONB NOT NULL DEFAULT '[]',
      user_consent    BOOLEAN,
      consent_ref     TEXT,
      human_oversight BOOLEAN NOT NULL DEFAULT false,
      oversight_actor TEXT,
      decision_output JSONB,
      input_summary   JSONB,
      risk_tier       TEXT CHECK (risk_tier IN ('prohibited','high','limited','minimal')),
      end_user_ref    TEXT,
      error           JSONB,
      appeal          JSONB,
      metadata        JSONB NOT NULL DEFAULT '{}',
      prev_hash       TEXT NOT NULL,
      record_hash     TEXT NOT NULL,
      UNIQUE (tenant_id, seq)
    );
    CREATE INDEX idx_logs_tenant_time    ON ai_call_logs(tenant_id, occurred_at);
    CREATE INDEX idx_logs_tenant_model   ON ai_call_logs(tenant_id, model_id);
    CREATE INDEX idx_logs_tenant_purpose ON ai_call_logs(tenant_id, system_purpose);

    CREATE TABLE risk_assessments (
      id            UUID PRIMARY KEY,
      tenant_id     UUID NOT NULL REFERENCES tenants(id),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      system_name   TEXT NOT NULL,
      input         JSONB NOT NULL,
      tier          TEXT NOT NULL CHECK (tier IN ('prohibited','high','limited','minimal')),
      confidence    TEXT NOT NULL CHECK (confidence IN ('high','indicative')),
      matched_rules JSONB NOT NULL,
      obligations   JSONB NOT NULL
    );
    CREATE INDEX idx_risk_tenant ON risk_assessments(tenant_id, created_at);

    CREATE TABLE incidents (
      id                    UUID PRIMARY KEY,
      tenant_id             UUID NOT NULL REFERENCES tenants(id),
      created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      occurred_at           TIMESTAMPTZ NOT NULL,
      severity              TEXT NOT NULL CHECK (severity IN ('serious','major','minor')),
      is_article_73         BOOLEAN NOT NULL DEFAULT false,
      title                 TEXT NOT NULL,
      description           TEXT NOT NULL,
      affected_users        INTEGER,
      related_log_ids       UUID[] NOT NULL DEFAULT '{}',
      remediation           JSONB,
      reported_to_authority BOOLEAN NOT NULL DEFAULT false,
      authority_ref         TEXT,
      status                TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open','investigating','remediated','closed'))
    );
    CREATE INDEX idx_incidents_tenant ON incidents(tenant_id, occurred_at);

    CREATE TABLE audit_pack_exports (
      id             UUID PRIMARY KEY,
      tenant_id      UUID NOT NULL REFERENCES tenants(id),
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      range_from     TIMESTAMPTZ NOT NULL,
      range_to       TIMESTAMPTZ NOT NULL,
      record_count   INTEGER NOT NULL,
      chain_verified BOOLEAN NOT NULL,
      pack_sha256    TEXT
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS audit_pack_exports;
    DROP TABLE IF EXISTS incidents;
    DROP TABLE IF EXISTS risk_assessments;
    DROP TABLE IF EXISTS ai_call_logs;
    DROP TABLE IF EXISTS tenant_chain_heads;
    DROP TABLE IF EXISTS api_keys;
    DROP TABLE IF EXISTS tenants;
  `);
};
