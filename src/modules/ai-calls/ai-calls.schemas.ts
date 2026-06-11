import { Type } from '@sinclair/typebox';

export const RiskTier = Type.Union([
  Type.Literal('prohibited'),
  Type.Literal('high'),
  Type.Literal('limited'),
  Type.Literal('minimal'),
]);

export const LogAiCallBody = Type.Object({
  occurred_at: Type.String({ format: 'date-time' }),
  model_id: Type.String({ minLength: 1, maxLength: 200 }),
  model_version: Type.Optional(Type.String({ maxLength: 200 })),
  prompt_version: Type.Optional(Type.String({ maxLength: 200 })),
  system_purpose: Type.Optional(Type.String({ maxLength: 500 })),
  data_sources: Type.Optional(Type.Array(Type.String({ maxLength: 500 }), { maxItems: 100 })),
  user_consent: Type.Optional(Type.Boolean()),
  consent_ref: Type.Optional(Type.String({ maxLength: 500 })),
  human_oversight: Type.Boolean({
    description: 'Article 14 — was a human in a position to oversee/intervene?',
  }),
  oversight_actor: Type.Optional(Type.String({ maxLength: 200 })),
  decision_output: Type.Optional(Type.Unknown()),
  input_summary: Type.Optional(
    Type.Unknown({ description: 'Prompt metadata — do NOT send raw personal data' }),
  ),
  risk_tier: Type.Optional(RiskTier),
  end_user_ref: Type.Optional(Type.String({ maxLength: 200 })),
  error: Type.Optional(Type.Unknown()),
  appeal: Type.Optional(Type.Unknown()),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export const LogReceipt = Type.Object({
  id: Type.String(),
  seq: Type.Number(),
  record_hash: Type.String(),
  prev_hash: Type.String(),
  recorded_at: Type.String(),
});

export const BatchLogBody = Type.Object({
  records: Type.Array(LogAiCallBody, { minItems: 1, maxItems: 500 }),
});

export const BatchLogResponse = Type.Object({
  receipts: Type.Array(LogReceipt),
});

export const AiCallRecord = Type.Object(
  {
    id: Type.String(),
    seq: Type.Number(),
    occurred_at: Type.String(),
    recorded_at: Type.String(),
    model_id: Type.String(),
    model_version: Type.Union([Type.String(), Type.Null()]),
    prompt_version: Type.Union([Type.String(), Type.Null()]),
    system_purpose: Type.Union([Type.String(), Type.Null()]),
    data_sources: Type.Array(Type.String()),
    user_consent: Type.Union([Type.Boolean(), Type.Null()]),
    consent_ref: Type.Union([Type.String(), Type.Null()]),
    human_oversight: Type.Boolean(),
    oversight_actor: Type.Union([Type.String(), Type.Null()]),
    decision_output: Type.Unknown(),
    input_summary: Type.Unknown(),
    risk_tier: Type.Union([RiskTier, Type.Null()]),
    end_user_ref: Type.Union([Type.String(), Type.Null()]),
    error: Type.Unknown(),
    appeal: Type.Unknown(),
    metadata: Type.Unknown(),
    prev_hash: Type.String(),
    record_hash: Type.String(),
  },
  { additionalProperties: true },
);

export const ListAiCallsQuery = Type.Object({
  from: Type.Optional(Type.String({ format: 'date-time' })),
  to: Type.Optional(Type.String({ format: 'date-time' })),
  model_id: Type.Optional(Type.String()),
  system_purpose: Type.Optional(Type.String()),
  risk_tier: Type.Optional(RiskTier),
  human_oversight: Type.Optional(Type.Boolean()),
  has_error: Type.Optional(Type.Boolean()),
  end_user_ref: Type.Optional(Type.String()),
  cursor: Type.Optional(Type.Number({ description: 'seq of the last item from previous page' })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 200, default: 50 })),
});

export const ListAiCallsResponse = Type.Object({
  items: Type.Array(AiCallRecord),
  next_cursor: Type.Union([Type.Number(), Type.Null()]),
});
