import { Type } from '@sinclair/typebox';

export const Severity = Type.Union([
  Type.Literal('serious'),
  Type.Literal('major'),
  Type.Literal('minor'),
]);

export const IncidentStatus = Type.Union([
  Type.Literal('open'),
  Type.Literal('investigating'),
  Type.Literal('remediated'),
  Type.Literal('closed'),
]);

const Remediation = Type.Object({
  actions: Type.Optional(Type.Array(Type.String())),
  status: Type.Optional(Type.String()),
  completed_at: Type.Optional(Type.String({ format: 'date-time' })),
});

export const IncidentReportBody = Type.Object({
  occurred_at: Type.String({ format: 'date-time' }),
  severity: Severity,
  title: Type.String({ minLength: 1, maxLength: 300 }),
  description: Type.String({ minLength: 1, maxLength: 20_000 }),
  affected_users: Type.Optional(Type.Integer({ minimum: 0 })),
  related_log_ids: Type.Optional(Type.Array(Type.String({ format: 'uuid' }), { maxItems: 500 })),
  remediation: Type.Optional(Remediation),
  is_article_73: Type.Optional(Type.Boolean()),
  reported_to_authority: Type.Optional(Type.Boolean()),
  authority_ref: Type.Optional(Type.String({ maxLength: 500 })),
});

export const IncidentResponse = Type.Object(
  {
    id: Type.String(),
    created_at: Type.String(),
    occurred_at: Type.String(),
    severity: Severity,
    is_article_73: Type.Boolean(),
    title: Type.String(),
    description: Type.String(),
    affected_users: Type.Union([Type.Integer(), Type.Null()]),
    related_log_ids: Type.Array(Type.String()),
    remediation: Type.Unknown(),
    reported_to_authority: Type.Boolean(),
    authority_ref: Type.Union([Type.String(), Type.Null()]),
    status: IncidentStatus,
    article_73_note: Type.Optional(Type.String()),
  },
  { additionalProperties: true },
);

export const IncidentPatchBody = Type.Partial(
  Type.Object({
    status: IncidentStatus,
    remediation: Remediation,
    reported_to_authority: Type.Boolean(),
    authority_ref: Type.String({ maxLength: 500 }),
    affected_users: Type.Integer({ minimum: 0 }),
  }),
);

export const ListIncidentsQuery = Type.Object({
  severity: Type.Optional(Severity),
  status: Type.Optional(IncidentStatus),
  from: Type.Optional(Type.String({ format: 'date-time' })),
  to: Type.Optional(Type.String({ format: 'date-time' })),
});
