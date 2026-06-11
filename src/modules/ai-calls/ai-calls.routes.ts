import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { tenantIdOf } from '../../plugins/auth.js';
import {
  AiCallRecord,
  BatchLogBody,
  BatchLogResponse,
  ListAiCallsQuery,
  ListAiCallsResponse,
  LogAiCallBody,
  LogReceipt,
} from './ai-calls.schemas.js';
import {
  appendAiCalls,
  getAiCall,
  listAiCalls,
  type LogAiCallInput,
  type ListFilters,
} from './ai-calls.service.js';

export default async function aiCallsRoutes(app: FastifyInstance) {
  app.post(
    '/log-ai-call',
    {
      preHandler: app.requireTenant,
      schema: { tags: ['ai-calls'], body: LogAiCallBody, response: { 201: LogReceipt } },
    },
    async (request, reply) => {
      const receipts = await appendAiCalls(app.db, tenantIdOf(request), [
        request.body as LogAiCallInput,
      ]);
      return reply.status(201).send(receipts[0]);
    },
  );

  app.post(
    '/log-ai-call/batch',
    {
      preHandler: app.requireTenant,
      schema: { tags: ['ai-calls'], body: BatchLogBody, response: { 201: BatchLogResponse } },
    },
    async (request, reply) => {
      const { records } = request.body as { records: LogAiCallInput[] };
      const receipts = await appendAiCalls(app.db, tenantIdOf(request), records);
      return reply.status(201).send({ receipts });
    },
  );

  app.get(
    '/ai-calls',
    {
      preHandler: app.requireTenant,
      schema: {
        tags: ['ai-calls'],
        querystring: ListAiCallsQuery,
        response: { 200: ListAiCallsResponse },
      },
    },
    async (request) => listAiCalls(app.db, tenantIdOf(request), request.query as ListFilters),
  );

  app.get(
    '/ai-calls/:id',
    {
      preHandler: app.requireTenant,
      schema: {
        tags: ['ai-calls'],
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        response: { 200: AiCallRecord },
      },
    },
    async (request) =>
      getAiCall(app.db, tenantIdOf(request), (request.params as { id: string }).id),
  );
}
