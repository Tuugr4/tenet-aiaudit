import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { tenantIdOf } from '../../plugins/auth.js';
import { verifyTenantChain } from './verification.service.js';

const VerifyQuery = Type.Object({
  from_seq: Type.Optional(Type.Number({ minimum: 1 })),
  to_seq: Type.Optional(Type.Number({ minimum: 1 })),
});

const VerifyResponse = Type.Object({
  valid: Type.Boolean(),
  checked_records: Type.Number(),
  first_invalid_seq: Type.Optional(Type.Number()),
  reason: Type.Optional(Type.String()),
  from_seq: Type.Number(),
  to_seq: Type.Number(),
  head_seq: Type.Number(),
  head_hash: Type.String(),
});

export default async function verificationRoutes(app: FastifyInstance) {
  app.get(
    '/verify-chain',
    {
      preHandler: app.requireTenant,
      schema: { tags: ['verification'], querystring: VerifyQuery, response: { 200: VerifyResponse } },
    },
    async (request) => {
      const q = request.query as { from_seq?: number; to_seq?: number };
      const result = await verifyTenantChain(app.db, tenantIdOf(request), {
        fromSeq: q.from_seq,
        toSeq: q.to_seq,
      });
      return {
        valid: result.valid,
        checked_records: result.checkedRecords,
        first_invalid_seq: result.firstInvalidSeq,
        reason: result.reason,
        from_seq: result.fromSeq,
        to_seq: result.toSeq,
        head_seq: result.headSeq,
        head_hash: result.headHash,
      };
    },
  );
}
