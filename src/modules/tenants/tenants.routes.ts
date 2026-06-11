import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  CreateTenantBody,
  CreateTenantResponse,
  IssueKeyBody,
  IssueKeyResponse,
  TenantResponse,
} from './tenants.schemas.js';
import { createTenant, issueTenantKey, listTenants, revokeKey } from './tenants.service.js';

export default async function tenantsRoutes(app: FastifyInstance) {
  app.post(
    '/admin/tenants',
    {
      preHandler: app.requireAdmin,
      schema: {
        tags: ['admin'],
        body: CreateTenantBody,
        response: { 201: CreateTenantResponse },
      },
    },
    async (request, reply) => {
      const { name, slug } = request.body as { name: string; slug: string };
      const result = await createTenant(app.db, name, slug);
      return reply.status(201).send({
        ...result,
        tenant: { ...result.tenant, createdAt: result.tenant.createdAt.toISOString() },
      });
    },
  );

  app.get(
    '/admin/tenants',
    {
      preHandler: app.requireAdmin,
      schema: { tags: ['admin'], response: { 200: Type.Array(TenantResponse) } },
    },
    async () => {
      const tenants = await listTenants(app.db);
      return tenants.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }));
    },
  );

  app.post(
    '/admin/tenants/:tenantId/api-keys',
    {
      preHandler: app.requireAdmin,
      schema: {
        tags: ['admin'],
        params: Type.Object({ tenantId: Type.String({ format: 'uuid' }) }),
        body: IssueKeyBody,
        response: { 201: IssueKeyResponse },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };
      const { label } = request.body as { label?: string };
      const key = await issueTenantKey(app.db, tenantId, label);
      return reply.status(201).send(key);
    },
  );

  app.delete(
    '/admin/api-keys/:keyId',
    {
      preHandler: app.requireAdmin,
      schema: {
        tags: ['admin'],
        params: Type.Object({ keyId: Type.String({ format: 'uuid' }) }),
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      const { keyId } = request.params as { keyId: string };
      await revokeKey(app.db, keyId);
      return reply.status(204).send();
    },
  );
}
