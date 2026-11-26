import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../utils/errors.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `No route matches ${req.method} ${req.path}.`));
};

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const restaurantId = req.staff?.restaurantId
    ? String(req.staff.restaurantId)
    : req.customer?.restaurantId
      ? String(req.customer.restaurantId)
      : undefined;

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

  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'error',
    requestId: req.requestId,
    method: req.method,
    route: req.path,
    errorClass: error instanceof Error ? error.name : 'UnknownError',
    message: error instanceof Error ? error.message : 'Unknown server error',
    ...(restaurantId ? { restaurantId } : {})
  }));
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
};
