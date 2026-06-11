import Fastify, { type FastifyInstance } from 'fastify';
import ajvFormatsModule from 'ajv-formats';

// ajv-formats ships CJS `export =`; normalize to a callable ajv plugin.
const ajvFormats = ((ajvFormatsModule as { default?: unknown }).default ??
  ajvFormatsModule) as (ajv: unknown) => unknown;
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { Config } from './config.js';
import { createDb, type Sql } from './db/client.js';
import errorHandler from './plugins/error-handler.js';
import authPlugin from './plugins/auth.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import swaggerPlugin from './plugins/swagger.js';
import tenantsRoutes from './modules/tenants/tenants.routes.js';
import aiCallsRoutes from './modules/ai-calls/ai-calls.routes.js';
import riskRoutes from './modules/risk/risk.routes.js';
import incidentsRoutes from './modules/incidents/incidents.routes.js';
import auditPackRoutes from './modules/audit-pack/audit-pack.routes.js';
import verificationRoutes from './modules/verification/verification.routes.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Sql;
    appConfig: Config;
  }
}

export interface BuildAppOptions {
  config: Config;
  /** Inject an existing sql client (tests); otherwise one is created from config. */
  db?: Sql;
}

export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: opts.config.LOG_LEVEL,
      redact: {
        paths: [
          'req.headers.authorization',
          // Never log AI payloads: they may contain personal data.
          'decision_output',
          'input_summary',
        ],
        censor: '[REDACTED]',
      },
    },
    ajv: {
      customOptions: { removeAdditional: false, coerceTypes: true },
      plugins: [ajvFormats as never],
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  const db = opts.db ?? createDb(opts.config.DATABASE_URL);
  const ownsDb = !opts.db;

  app.decorate('db', db);
  app.decorate('appConfig', opts.config);

  await app.register(errorHandler);
  await app.register(authPlugin);
  await app.register(rateLimitPlugin);
  await app.register(swaggerPlugin);

  app.get('/healthz', { schema: { tags: ['system'], security: [] } }, async () => ({
    status: 'ok',
  }));

  app.get('/readyz', { schema: { tags: ['system'], security: [] } }, async (_req, reply) => {
    try {
      await db`SELECT 1`;
      return { status: 'ready' };
    } catch {
      return reply.status(503).send({ status: 'unavailable' });
    }
  });

  await app.register(tenantsRoutes, { prefix: '/v1' });
  await app.register(aiCallsRoutes, { prefix: '/v1' });
  await app.register(riskRoutes, { prefix: '/v1' });
  await app.register(incidentsRoutes, { prefix: '/v1' });
  await app.register(auditPackRoutes, { prefix: '/v1' });
  await app.register(verificationRoutes, { prefix: '/v1' });

  if (ownsDb) {
    app.addHook('onClose', async () => {
      await db.end({ timeout: 5 });
    });
  }

  return app;
}
