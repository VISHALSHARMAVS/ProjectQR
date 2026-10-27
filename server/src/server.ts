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
  httpServer.listen(env.PORT, '0.0.0.0', () => console.info(`ProjectQR server listening on port ${env.PORT}`));

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
