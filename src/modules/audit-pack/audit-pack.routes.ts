import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { tenantIdOf } from '../../plugins/auth.js';
import { buildAuditPack } from './audit-pack.service.js';

const ExportQuery = Type.Object({
  from: Type.String({ format: 'date-time' }),
  to: Type.String({ format: 'date-time' }),
  include_incidents: Type.Optional(Type.Boolean({ default: true })),
});

export default async function auditPackRoutes(app: FastifyInstance) {
  app.get(
    '/export-audit-pack',
    {
      preHandler: app.requireTenant,
      schema: {
        tags: ['audit-pack'],
        querystring: ExportQuery,
        produces: ['application/zip'],
      },
    },
    async (request, reply) => {
      const q = request.query as { from: string; to: string; include_incidents?: boolean };
      const pack = await buildAuditPack(app.db, request.log, tenantIdOf(request), {
        from: q.from,
        to: q.to,
        includeIncidents: q.include_incidents ?? true,
      });
      return reply
        .header('content-disposition', `attachment; filename="${pack.filename}"`)
        .header('x-pack-id', pack.packId)
        .type('application/zip')
        .send(pack.stream);
    },
  );
}
