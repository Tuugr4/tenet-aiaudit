import type { FastifyInstance } from 'fastify';
import { tenantIdOf } from '../../plugins/auth.js';
import { RiskClassifyBody, RiskClassifyResponse, ListAssessmentsResponse } from './risk.schemas.js';
import { classifyAndPersist, listAssessments, type ClassifyInput } from './risk.service.js';

export default async function riskRoutes(app: FastifyInstance) {
  app.post(
    '/risk-classify',
    {
      preHandler: app.requireTenant,
      schema: { tags: ['risk'], body: RiskClassifyBody, response: { 200: RiskClassifyResponse } },
    },
    async (request) => {
      const body = request.body as ClassifyInput & { persist?: boolean };
      return classifyAndPersist(app.db, tenantIdOf(request), body, body.persist ?? true);
    },
  );

  app.get(
    '/risk-assessments',
    {
      preHandler: app.requireTenant,
      schema: { tags: ['risk'], response: { 200: ListAssessmentsResponse } },
    },
    async (request) => listAssessments(app.db, tenantIdOf(request)),
  );
}
