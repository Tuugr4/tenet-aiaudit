import { uuidv7 } from 'uuidv7';
import type { Sql } from '../../db/client.js';
import { notFound } from '../../shared/errors.js';

export const ARTICLE_73_NOTE =
  'Flagged as a serious incident under Article 73. As a general rule it must be reported to the market surveillance authority within 15 days of awareness (2 days for widespread infringement or serious irreparable harm, immediately for death).';

export interface IncidentInput {
  occurred_at: string;
  severity: 'serious' | 'major' | 'minor';
  title: string;
  description: string;
  affected_users?: number;
  related_log_ids?: string[];
  remediation?: unknown;
  is_article_73?: boolean;
  reported_to_authority?: boolean;
  authority_ref?: string;
}

export async function createIncident(sql: Sql, tenantId: string, input: IncidentInput) {
  const id = uuidv7();
  // Serious incidents always fall under Article 73 regardless of the caller's flag.
  const isArticle73 = input.severity === 'serious' ? true : (input.is_article_73 ?? false);

  const [row] = await sql`
    INSERT INTO incidents (
      id, tenant_id, occurred_at, severity, is_article_73, title, description,
      affected_users, related_log_ids, remediation, reported_to_authority, authority_ref
    ) VALUES (
      ${id}, ${tenantId}, ${input.occurred_at}, ${input.severity}, ${isArticle73},
      ${input.title}, ${input.description}, ${input.affected_users ?? null},
      ${input.related_log_ids ?? []},
      ${input.remediation ? sql.json(input.remediation as never) : null},
      ${input.reported_to_authority ?? false}, ${input.authority_ref ?? null}
    )
    RETURNING *
  `;
  return rowToApi(row!);
}

export async function patchIncident(
  sql: Sql,
  tenantId: string,
  id: string,
  patch: Record<string, unknown>,
) {
  const rows = await sql`
    UPDATE incidents SET
      status = COALESCE(${(patch.status as string) ?? null}, status),
      remediation = COALESCE(${patch.remediation ? sql.json(patch.remediation as never) : null}, remediation),
      reported_to_authority = COALESCE(${(patch.reported_to_authority as boolean) ?? null}, reported_to_authority),
      authority_ref = COALESCE(${(patch.authority_ref as string) ?? null}, authority_ref),
      affected_users = COALESCE(${(patch.affected_users as number) ?? null}, affected_users)
    WHERE tenant_id = ${tenantId} AND id = ${id}
    RETURNING *
  `;
  if (rows.length === 0) throw notFound('Incident not found');
  return rowToApi(rows[0]!);
}

export interface IncidentFilters {
  severity?: string;
  status?: string;
  from?: string;
  to?: string;
}

export async function listIncidents(sql: Sql, tenantId: string, f: IncidentFilters) {
  const rows = await sql`
    SELECT * FROM incidents
    WHERE tenant_id = ${tenantId}
      ${f.severity ? sql`AND severity = ${f.severity}` : sql``}
      ${f.status ? sql`AND status = ${f.status}` : sql``}
      ${f.from ? sql`AND occurred_at >= ${f.from}` : sql``}
      ${f.to ? sql`AND occurred_at <= ${f.to}` : sql``}
    ORDER BY occurred_at DESC
    LIMIT 500
  `;
  return rows.map(rowToApi);
}

export function rowToApi(row: Record<string, unknown>) {
  const isArticle73 = row.isArticle73 as boolean;
  return {
    id: row.id as string,
    created_at: (row.createdAt as Date).toISOString(),
    occurred_at: (row.occurredAt as Date).toISOString(),
    severity: row.severity as string,
    is_article_73: isArticle73,
    title: row.title as string,
    description: row.description as string,
    affected_users: (row.affectedUsers as number | null) ?? null,
    related_log_ids: (row.relatedLogIds as string[]) ?? [],
    remediation: row.remediation ?? null,
    reported_to_authority: row.reportedToAuthority as boolean,
    authority_ref: (row.authorityRef as string | null) ?? null,
    status: row.status as string,
    ...(isArticle73 ? { article_73_note: ARTICLE_73_NOTE } : {}),
  };
}
