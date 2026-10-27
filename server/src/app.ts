import path from 'node:path';
import { createServer, type Server as HttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session, { type Store } from 'express-session';
import MongoStore from 'connect-mongo';
import { Server as SocketServer } from 'socket.io';
import { env } from './config/env.js';
import { CustomerSession } from './models/CustomerSession.js';
import { Restaurant } from './models/Restaurant.js';
import { User } from './models/User.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRouter from './routes/auth.js';
import { categoryRouter, menuRouter } from './routes/catalog.js';
import { customerRouter, publicRouter } from './routes/customer.js';
import { mountOrderRoutes } from './routes/orders.js';
import { restaurantRouter, staffRouter, tablesRouter } from './routes/restaurant.js';
import { AppError } from './utils/errors.js';

export interface ProjectQrApplication {
  app: Express;
  httpServer: HttpServer;
  io: SocketServer;
}

export function createApplication(sessionStore?: Store): ProjectQrApplication {
  const app = express();
  if (env.NODE_ENV === 'production') app.set('trust proxy', 1);
  const sessionMiddleware = session({
    name: 'projectqr.sid',
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore ?? MongoStore.create({ mongoUrl: env.MONGODB_URI, collectionName: 'httpSessions', ttl: 60 * 60 * 24 * 7 }),
    cookie: {
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    }
  });

  app.disable('x-powered-by');
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"]
      }
    }
  }));
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] }));
  app.use((req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (origin && origin !== env.CLIENT_ORIGIN) return next(new AppError(403, 'ORIGIN_REJECTED', 'Request origin is not allowed.'));
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(sessionMiddleware);
  app.use('/uploads', express.static(path.resolve(env.uploadPath), { maxAge: env.NODE_ENV === 'production' ? '1d' : 0, immutable: env.NODE_ENV === 'production' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/customer', customerRouter);
  app.use('/api/categories', categoryRouter);
  app.use('/api/menu', menuRouter);
  app.use('/api/tables', tablesRouter);
  app.use('/api/restaurant', restaurantRouter);
  app.use('/api/restaurant/staff', staffRouter);

  const httpServer = createServer(app);
  const io = new SocketServer(httpServer, {
    cors: { origin: env.CLIENT_ORIGIN, credentials: true },
    transports: ['websocket', 'polling']
  });
  io.engine.use(sessionMiddleware);
  io.use(async (socket, next) => {
    try {
      const request = socket.request as typeof socket.request & { session?: Express.Request['session'] };
      const origin = socket.handshake.headers.origin;
      if (origin && origin !== env.CLIENT_ORIGIN) return next(new Error('Origin not allowed'));
      const currentSession = request.session;
      if (!currentSession) return next(new Error('Authentication required'));
      if (currentSession.userId) {
        const user = await User.findOne({ _id: currentSession.userId, active: true }).select('_id restaurantId');
        if (!user || !await Restaurant.exists({ _id: user.restaurantId, active: true })) return next(new Error('Authentication required'));
        socket.data.principal = { type: 'staff', userId: String(user._id), restaurantId: String(user.restaurantId) };
        return next();
      }
      if (currentSession.customerSessionId) {
        const customerSession = await CustomerSession.findOne({ _id: currentSession.customerSessionId, revokedAt: null, expiresAt: { $gt: new Date() } }).select('_id');
        if (!customerSession) return next(new Error('Authentication required'));
        socket.data.principal = { type: 'customer', customerSessionId: String(customerSession._id) };
        return next();
      }
      next(new Error('Authentication required'));
    } catch (error) {
      next(error instanceof Error ? error : new Error('Authentication failed'));
    }
  });
  io.on('connection', (socket) => {
    const principal = socket.data.principal as { type: 'staff'; userId: string; restaurantId: string } | { type: 'customer'; customerSessionId: string };
    if (principal.type === 'staff') socket.join(`restaurant:${principal.restaurantId}`);
    else socket.join(`customer:${principal.customerSessionId}`);
    socket.emit('connection:ready', { connected: true });
    const checkTimer = setInterval(async () => {
      try {
        const valid = principal.type === 'staff'
          ? Boolean(await User.exists({ _id: principal.userId, active: true }) && await Restaurant.exists({ _id: principal.restaurantId, active: true }))
          : Boolean(await CustomerSession.exists({ _id: principal.customerSessionId, revokedAt: null, expiresAt: { $gt: new Date() } }));
        if (!valid) socket.disconnect(true);
      } catch {
        socket.disconnect(true);
      }
    }, 60_000);
    socket.on('disconnect', () => clearInterval(checkTimer));
  });
  mountOrderRoutes(app, io);

  if (env.NODE_ENV === 'production') {
    const clientBuildPath = fileURLToPath(new URL('../../client/dist/', import.meta.url));
    app.use(express.static(clientBuildPath));
    app.use((req, res, next) => {
      const isBackendPath = req.path === '/api' || req.path.startsWith('/api/')
        || req.path === '/uploads' || req.path.startsWith('/uploads/')
        || req.path === '/socket.io' || req.path.startsWith('/socket.io/');
      if (req.method !== 'GET' || isBackendPath) return next();
      res.sendFile(path.join(clientBuildPath, 'index.html'), (error) => {
        if (error) next(error);
      });
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, httpServer, io };
}
