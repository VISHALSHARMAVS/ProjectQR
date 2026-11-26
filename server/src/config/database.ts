import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase(uri = env.MONGODB_URI): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 20_000,
    connectTimeoutMS: 10_000,
    maxPoolSize: 25,
    minPoolSize: 2,
    heartbeatFrequencyMS: 10_000
  });
  console.info('Connected to MongoDB');
}
