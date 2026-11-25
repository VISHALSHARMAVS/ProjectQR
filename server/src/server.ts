import mongoose from 'mongoose';
import session from 'express-session';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { createApplication } from './app.js';

async function main(): Promise<void> {
  const useMemoryDatabase = process.env.PROJECTQR_DEV_MEMORY_DB === 'true';
  if (useMemoryDatabase && env.NODE_ENV !== 'development') {
    throw new Error('The in-memory database mode is only available in development.');
  }

  const memoryMongo = useMemoryDatabase
    ? await (await import('mongodb-memory-server')).MongoMemoryServer.create()
    : undefined;
  await connectDatabase(memoryMongo?.getUri('projectqr'));
  if (memoryMongo) console.info('Using disposable in-memory MongoDB; data will be discarded when the server stops.');

  const { httpServer, io } = createApplication(memoryMongo ? new session.MemoryStore() : undefined);
  httpServer.listen(env.PORT, '0.0.0.0', () => {
    console.info(`Mesa server listening on port ${env.PORT}`);

    // Automated 10-minute keep-alive ping to prevent Render free instance spin-down
    const rawUrl = env.PUBLIC_APP_URL || (process.env.RENDER_EXTERNAL_URL ?? '');
    if (env.NODE_ENV === 'production' && rawUrl) {
      const keepAliveUrl = `${rawUrl.replace(/\/$/, '')}/api/health`;
      const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes (well before the 15-minute sleep threshold)
      const timer = setInterval(async () => {
        try {
          const res = await fetch(keepAliveUrl);
          if (res.ok) {
            console.info(`[Keep-Alive] Pinged ${keepAliveUrl} successfully (${res.status})`);
          } else {
            console.warn(`[Keep-Alive] Ping ${keepAliveUrl} returned status ${res.status}`);
          }
        } catch (err) {
          console.warn(`[Keep-Alive] Ping failed:`, err instanceof Error ? err.message : err);
        }
      }, PING_INTERVAL_MS);
      timer.unref();
    }
  });

  let shuttingDown = false;
  const shutdown = (): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    const forceExit = setTimeout(() => process.exit(1), 10_000);
    forceExit.unref();
    void (async () => {
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await mongoose.disconnect();
      await memoryMongo?.stop();
      clearTimeout(forceExit);
      process.exit(0);
    })().catch((error: unknown) => {
      console.error('Failed to stop the API cleanly:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  console.error('Failed to start the API:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
});
