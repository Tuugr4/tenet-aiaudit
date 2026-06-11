import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

export default fp(async function swaggerPlugin(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Tenet Audit — EU AI Act Audit Log API',
        description:
          'Tamper-evident AI call logging, risk classification (Article 6 / Annex III), ' +
          'incident reporting (Article 73) and auditor-ready evidence packs (Article 12).',
        version: '0.1.0',
      },
      components: {
        securitySchemes: {
          apiKey: {
            type: 'http',
            scheme: 'bearer',
            description: 'Tenant key (ta_live_…) or admin key (ta_admin_…)',
          },
        },
      },
      security: [{ apiKey: [] }],
      tags: [
        { name: 'ai-calls', description: 'Article 12 record-keeping' },
        { name: 'risk', description: 'Article 6 / Annex III risk classification' },
        { name: 'incidents', description: 'Article 73 incident reporting' },
        { name: 'audit-pack', description: 'Auditor-ready evidence export' },
        { name: 'verification', description: 'Hash-chain integrity verification' },
        { name: 'admin', description: 'Tenant and API key management' },
        { name: 'system', description: 'Health and docs' },
      ],
    },
  });

  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());
});
