import path from 'node:path';
import { createServer, type Server as HttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session, { type Store } from 'express-session';
import MongoStore from 'connect-mongo';
import { Server as SocketServer } from 'socket.io';
import mongoose from 'mongoose';
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
import { customerReviewRouter, restaurantReviewRouter } from './routes/reviews.js';
import { webhooksRouter } from './routes/webhooks.js';
import { AppError } from './utils/errors.js';

export interface ProjectQrApplication {
  app: Express;
  httpServer: HttpServer;
  io: SocketServer;
}

export function isAllowedOrigin(origin: string | undefined, host?: string | null): boolean {
  if (!origin) return true;

  // 1. Same-origin match with current server host
  if (host) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host === host) return true;
    } catch {}
  }

  // 2. Explicitly configured origins in environment
  if (origin === env.CLIENT_ORIGIN || origin === env.PUBLIC_APP_URL) return true;

  // 3. Comma-separated ALLOWED_ORIGINS
  if (process.env.ALLOWED_ORIGINS) {
    const list = process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
    if (list.includes(origin)) return true;
  }

  // 4. Any official Mesa/ProjectQR deployment domain on onrender.com
  try {
    const originUrl = new URL(origin);
    if (originUrl.protocol === 'https:' && originUrl.hostname.endsWith('.onrender.com')) {
      const sub = originUrl.hostname.slice(0, -'.onrender.com'.length);
      if (
        sub === 'trymesa' ||
        sub === 'projectqr-preview' ||
        sub === 'mesa-preview' ||
        sub === 'mesa-dine' ||
        sub === 'mesa-order' ||
        sub === 'mesa-os' ||
        sub.startsWith('mesa-') ||
        sub.startsWith('projectqr-')
      ) {
        return true;
      }
    }
    if (env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(originUrl.hostname)) {
      return true;
    }
  } catch {}

  return false;
}

export function createApplication(sessionStore?: Store): ProjectQrApplication {
  const app = express();
  if (env.NODE_ENV === 'production') app.set('trust proxy', 1);
  const sessionMiddleware = session({
    name: 'projectqr.sid',
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore ?? MongoStore.create({
      mongoUrl: env.MONGODB_URI,
      collectionName: 'httpSessions',
      ttl: 60 * 60 * 24 * 7,
      touchAfter: 24 * 3600
    }),
    cookie: {
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    }
  });

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const host = req.get('host');
    if (host && (host.startsWith('projectqr-preview.') || host.startsWith('mesa-preview.'))) {
      const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
      return res.redirect(301, `${proto}://trymesa.onrender.com${req.originalUrl}`);
    }
    next();
  });
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"]
      }
    }
  }));
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
  }));
  app.use((req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.path.startsWith('/api/webhooks')) return next();
    const origin = req.get('origin');
    if (origin && !isAllowedOrigin(origin, req.get('host'))) {
      return next(new AppError(403, 'ORIGIN_REJECTED', 'Request origin is not allowed.'));
    }
    next();
  });
  app.use(express.json({
    limit: '1mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  }));
  app.use(sessionMiddleware);
  app.use('/uploads', express.static(path.resolve(env.uploadPath), { maxAge: env.NODE_ENV === 'production' ? '1d' : 0, immutable: env.NODE_ENV === 'production' }));
  app.get(['/health', '/api/health'], (_req, res) => res.json({
    status: 'ok',
    dbConnected: mongoose.connection.readyState === 1,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  }));
  app.use('/api/webhooks', webhooksRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/customer', customerRouter);
  app.use('/api/customer/reviews', customerReviewRouter);
  app.use('/api/categories', categoryRouter);
  app.use('/api/menu', menuRouter);
  app.use('/api/tables', tablesRouter);
  app.use('/api/restaurant', restaurantRouter);
  app.use('/api/restaurant/reviews', restaurantReviewRouter);
  app.use('/api/restaurant/staff', staffRouter);

  const httpServer = createServer(app);
  const io = new SocketServer(httpServer, {
    pingTimeout: 20_000,
    pingInterval: 25_000,
    cors: {
      origin: (origin, callback) => {
        if (!origin || isAllowedOrigin(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Origin not allowed'));
        }
      },
      credentials: true
    },
    transports: ['websocket', 'polling']
  });
  io.engine.use(sessionMiddleware);
  io.use(async (socket, next) => {
    try {
      const request = socket.request as typeof socket.request & { session?: Express.Request['session'] };
      const origin = socket.handshake.headers.origin;
      if (origin && !isAllowedOrigin(origin, socket.handshake.headers.host)) return next(new Error('Origin not allowed'));
      const currentSession = request.session;
      if (!currentSession) return next(new Error('Authentication required'));
      if (currentSession.userId) {
        const user = await User.findOne({ _id: currentSession.userId, active: true }).select('_id restaurantId');
        if (!user || !await Restaurant.exists({ _id: user.restaurantId, active: true })) return next(new Error('Authentication required'));
        socket.data.principal = { type: 'staff', userId: String(user._id), restaurantId: String(user.restaurantId) };
        return next();
      }
      if (currentSession.customerSessionId) {
        const customerSession = await CustomerSession.findOne({ _id: currentSession.customerSessionId, revokedAt: null, expiresAt: { $gt: new Date() } }).select('_id tableId restaurantId');
        if (!customerSession) return next(new Error('Authentication required'));
        socket.data.principal = {
          type: 'customer',
          customerSessionId: String(customerSession._id),
          tableId: String(customerSession.tableId),
          restaurantId: String(customerSession.restaurantId)
        };
        return next();
      }
      next(new Error('Authentication required'));
    } catch (error) {
      next(error instanceof Error ? error : new Error('Authentication failed'));
    }
  });
  io.on('connection', (socket) => {
    const principal = socket.data.principal as
      | { type: 'staff'; userId: string; restaurantId: string }
      | { type: 'customer'; customerSessionId: string; tableId: string; restaurantId: string };
    if (principal.type === 'staff') {
      socket.join(`restaurant:${principal.restaurantId}`);
    } else {
      socket.join(`customer:${principal.customerSessionId}`);
      socket.join(`table:${principal.tableId}`);
    }
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
    app.use(express.static(clientBuildPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else if (filePath.includes(path.sep + 'assets' + path.sep) || filePath.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
    app.use((req, res, next) => {
      const isBackendPath = req.path === '/api' || req.path.startsWith('/api/')
        || req.path === '/uploads' || req.path.startsWith('/uploads/')
        || req.path === '/socket.io' || req.path.startsWith('/socket.io/');
      if (req.method !== 'GET' || isBackendPath) return next();
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(clientBuildPath, 'index.html'), (error) => {
        if (error) next(error);
      });
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, httpServer, io };
}
