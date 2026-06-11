import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

export default fp(async function rateLimitPlugin(app: FastifyInstance) {
  await app.register(rateLimit, {
    timeWindow: '1 minute',
    max: (request) =>
      request.auth ? app.appConfig.RATE_LIMIT_AUTHENTICATED : app.appConfig.RATE_LIMIT_ANONYMOUS,
    keyGenerator: (request) => request.auth?.keyId ?? request.ip,
  });
});
