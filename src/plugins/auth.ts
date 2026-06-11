import fp from 'fastify-plugin';
import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { unauthorized, forbidden } from '../shared/errors.js';

export interface AuthContext {
  keyId: string;
  role: 'admin' | 'tenant';
  tenantId: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
  interface FastifyInstance {
    requireTenant: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function randomBase62(length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += BASE62[bytes[i]! % 62];
  return out;
}

export function generateApiKey(role: 'admin' | 'tenant'): {
  secret: string;
  keyHash: string;
  keyPrefix: string;
} {
  const secret = `ta_${role === 'admin' ? 'admin' : 'live'}_${randomBase62(43)}`;
  return { secret, keyHash: hashApiKey(secret), keyPrefix: secret.slice(0, 12) };
}

/** 256-bit random secrets need no slow hash — a single sha256 suffices. */
export function hashApiKey(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export default fp(async function authPlugin(app: FastifyInstance) {
  const lastUsedFlushed = new Map<string, number>();

  app.decorateRequest('auth', null);

  app.addHook('onRequest', async (request) => {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return;
    const secret = header.slice('Bearer '.length).trim();
    if (!secret.startsWith('ta_')) return;

    const keyHash = hashApiKey(secret);
    const rows = await app.db<
      { id: string; role: 'admin' | 'tenant'; tenantId: string | null; tenantStatus: string | null }[]
    >`
      SELECT k.id, k.role, k.tenant_id, t.status AS tenant_status
      FROM api_keys k
      LEFT JOIN tenants t ON t.id = k.tenant_id
      WHERE k.key_hash = ${keyHash} AND k.revoked_at IS NULL
    `;
    const row = rows[0];
    if (!row) return;
    if (row.role === 'tenant' && row.tenantStatus !== 'active') return;

    request.auth = { keyId: row.id, role: row.role, tenantId: row.tenantId };

    const now = Date.now();
    const last = lastUsedFlushed.get(row.id) ?? 0;
    if (now - last > 60_000) {
      lastUsedFlushed.set(row.id, now);
      app.db`UPDATE api_keys SET last_used_at = now() WHERE id = ${row.id}`.catch((err) =>
        app.log.warn({ err }, 'failed to update last_used_at'),
      );
    }
  });

  app.decorate('requireTenant', async (request: FastifyRequest) => {
    if (!request.auth) throw unauthorized('Missing or invalid API key');
    if (request.auth.role !== 'tenant' || !request.auth.tenantId) {
      throw forbidden('A tenant API key is required for this endpoint');
    }
  });

  app.decorate('requireAdmin', async (request: FastifyRequest) => {
    if (!request.auth) throw unauthorized('Missing or invalid API key');
    if (request.auth.role !== 'admin') {
      throw forbidden('An admin API key is required for this endpoint');
    }
  });
});

/** Tenant id for a request that passed requireTenant. */
export function tenantIdOf(request: FastifyRequest): string {
  const id = request.auth?.tenantId;
  if (!id) throw unauthorized('Missing tenant context');
  return id;
}
