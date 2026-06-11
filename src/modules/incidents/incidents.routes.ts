import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { tenantIdOf } from '../../plugins/auth.js';
import {
  IncidentPatchBody,
  IncidentReportBody,
  IncidentResponse,
  ListIncidentsQuery,
} from './incidents.schemas.js';
import {
  createIncident,
  listIncidents,
  patchIncident,
  type IncidentFilters,
  type IncidentInput,
} from './incidents.service.js';

export default async function incidentsRoutes(app: FastifyInstance) {
  app.post(
    '/incident-report',
    {
      preHandler: app.requireTenant,
      schema: { tags: ['incidents'], body: IncidentReportBody, response: { 201: IncidentResponse } },
    },
    async (request, reply) => {
      const incident = await createIncident(
        app.db,
        tenantIdOf(request),
        request.body as IncidentInput,
      );
      return reply.status(201).send(incident);
    },
  );

  app.get(
    '/incidents',
    {
      preHandler: app.requireTenant,
      schema: {
        tags: ['incidents'],
        querystring: ListIncidentsQuery,
        response: { 200: Type.Array(IncidentResponse) },
      },
    },
    async (request) =>
      listIncidents(app.db, tenantIdOf(request), request.query as IncidentFilters),
  );

  app.patch(
    '/incidents/:id',
    {
      preHandler: app.requireTenant,
      schema: {
        tags: ['incidents'],
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        body: IncidentPatchBody,
        response: { 200: IncidentResponse },
      },
    },
    async (request) =>
      patchIncident(
        app.db,
        tenantIdOf(request),
        (request.params as { id: string }).id,
        request.body as Record<string, unknown>,
      ),
  );
}
