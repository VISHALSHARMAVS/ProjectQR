if (process.env.NODE_ENV === 'production') {
  throw new Error('The in-memory database mode is only available in development.');
}

process.env.PROJECTQR_DEV_MEMORY_DB = 'true';
await import('./server.js');
