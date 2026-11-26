import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    rawBody?: Buffer;
  }
}

export const requestLogger: RequestHandler = (req, res, next) => {
  const requestId = req.get('x-request-id')?.slice(0, 64) || randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  if (!req.path.startsWith('/api') || req.path === '/api/health') {
    return next();
  }

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    if (process.env.NODE_ENV === 'test') return;
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const restaurantId = req.staff?.restaurantId
      ? String(req.staff.restaurantId)
      : req.customer?.restaurantId
        ? String(req.customer.restaurantId)
        : undefined;

    console.info(JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId,
      method: req.method,
      route: req.baseUrl ? `${req.baseUrl}${req.route?.path ?? req.path}` : req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      ...(restaurantId ? { restaurantId } : {})
    }));
  });

  next();
};
