import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../utils/errors.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `No route matches ${req.method} ${req.path}.`));
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: { code: 'INVALID_DATA', message: 'Please check the submitted information.' } });
    return;
  }
  if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
    res.status(409).json({ error: { code: 'DUPLICATE_RECORD', message: 'That value is already in use.' } });
    return;
  }
  if (error && typeof error === 'object' && 'name' in error && error.name === 'MulterError') {
    res.status(400).json({ error: { code: 'UPLOAD_ERROR', message: 'The image could not be uploaded. Use an image up to 5 MB.' } });
    return;
  }
  if (error instanceof Error) console.error(error.message);
  else console.error('Unknown server error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
};
