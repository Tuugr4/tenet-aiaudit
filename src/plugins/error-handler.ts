import fp from 'fastify-plugin';
import type { FastifyError, FastifyInstance } from 'fastify';
import { AppError } from '../shared/errors.js';

export default fp(async function errorHandler(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError | AppError, request, reply) => {
    if (err instanceof AppError) {
      return reply
        .status(err.status)
        .type('application/problem+json')
        .send({
          type: err.type,
          title: err.title,
          status: err.status,
          detail: err.detail,
          instance: request.url,
        });
    }
    // Fastify schema validation errors carry statusCode 400
    if (err.validation) {
      return reply
        .status(400)
        .type('application/problem+json')
        .send({
          type: 'about:blank',
          title: 'Validation Error',
          status: 400,
          detail: err.message,
          instance: request.url,
        });
    }
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    if (status >= 500) request.log.error({ err }, 'unhandled error');
    return reply
      .status(status)
      .type('application/problem+json')
      .send({
        type: 'about:blank',
        title: status >= 500 ? 'Internal Server Error' : err.message,
        status,
        detail: status >= 500 ? undefined : err.message,
        instance: request.url,
      });
  });

  app.setNotFoundHandler((request, reply) => {
    reply
      .status(404)
      .type('application/problem+json')
      .send({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: `Route ${request.method} ${request.url} not found`,
        instance: request.url,
      });
  });
});
