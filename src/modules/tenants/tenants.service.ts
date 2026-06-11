import { uuidv7 } from 'uuidv7';
import type { Sql } from '../../db/client.js';
import { generateApiKey } from '../../plugins/auth.js';
import { genesisHash } from '../ai-calls/hash-chain.js';
import { conflict, notFound } from '../../shared/errors.js';

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: Date;
}

export async function createTenant(sql: Sql, name: string, slug: string) {
  const existing = await sql`SELECT 1 FROM tenants WHERE slug = ${slug}`;
  if (existing.length > 0) throw conflict(`Tenant slug "${slug}" already exists`);

  const tenantId = uuidv7();
  const keyId = uuidv7();
  const key = generateApiKey('tenant');
  const genesis = genesisHash(tenantId);

  const tenant = await sql.begin(async (tx) => {
    const [row] = await tx<TenantRow[]>`
      INSERT INTO tenants (id, name, slug)
      VALUES (${tenantId}, ${name}, ${slug})
      RETURNING id, name, slug, status, created_at
    `;
    await tx`
      INSERT INTO tenant_chain_heads (tenant_id, seq, head_hash)
      VALUES (${tenantId}, 0, ${genesis})
    `;
    await tx`
      INSERT INTO api_keys (id, tenant_id, key_hash, key_prefix, role, label)
      VALUES (${keyId}, ${tenantId}, ${key.keyHash}, ${key.keyPrefix}, 'tenant', 'initial key')
    `;
    return row!;
  });

  return {
    tenant,
    apiKey: { id: keyId, secret: key.secret, keyPrefix: key.keyPrefix },
    genesisHash: genesis,
  };
}

export async function listTenants(sql: Sql): Promise<TenantRow[]> {
  return sql<TenantRow[]>`
    SELECT id, name, slug, status, created_at FROM tenants ORDER BY created_at DESC
  `;
}

export async function issueTenantKey(sql: Sql, tenantId: string, label?: string) {
  const [tenant] = await sql`SELECT id FROM tenants WHERE id = ${tenantId}`;
  if (!tenant) throw notFound('Tenant not found');

  const keyId = uuidv7();
  const key = generateApiKey('tenant');
  await sql`
    INSERT INTO api_keys (id, tenant_id, key_hash, key_prefix, role, label)
    VALUES (${keyId}, ${tenantId}, ${key.keyHash}, ${key.keyPrefix}, 'tenant', ${label ?? null})
  `;
  return { id: keyId, secret: key.secret, keyPrefix: key.keyPrefix };
}

export async function revokeKey(sql: Sql, keyId: string) {
  const rows = await sql`
    UPDATE api_keys SET revoked_at = now()
    WHERE id = ${keyId} AND revoked_at IS NULL
    RETURNING id
  `;
  if (rows.length === 0) throw notFound('API key not found or already revoked');
}
