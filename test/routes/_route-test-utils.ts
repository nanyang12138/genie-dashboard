/**
 * Shared utilities for route testing.
 *
 * Creates minimal Fastify instances with just the route module under test
 * and a mock context. Uses app.inject() for HTTP testing without real ports.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import { ApiErrorCode, createErrorResponse, getErrorMessage } from '../../src/types.js';
import { createMockRouteContext, type MockRouteContext } from '../mocks/index.js';

export interface RouteTestHarness {
  app: FastifyInstance;
  ctx: MockRouteContext;
}

/**
 * Creates a Fastify instance with a route module registered against a mock context.
 *
 * @param registerFn - The route registration function (e.g., registerSessionRoutes).
 *   Uses `any` for ctx parameter because route functions expect typed port intersections
 *   that MockRouteContext satisfies structurally but not nominally.
 * @param ctxOptions - Optional overrides for the mock context
 */
export async function createRouteTestHarness(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerFn: (app: FastifyInstance, ctx: any) => void,
  ctxOptions?: { sessionId?: string }
): Promise<RouteTestHarness> {
  const app = Fastify({ logger: false });

  // Register cookie plugin — some routes access req.cookies
  await app.register(fastifyCookie);

  const ctx = createMockRouteContext(ctxOptions);

  // Match production error handler from server.ts for structured errors
  app.setErrorHandler((error, _req, reply) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    const body = (error as { body?: unknown }).body;
    if (body) {
      reply.code(statusCode).send(body);
    } else {
      reply.code(statusCode).send(createErrorResponse(ApiErrorCode.OPERATION_FAILED, getErrorMessage(error)));
    }
  });

  registerFn(app, ctx);
  await app.ready();

  return { app, ctx };
}
