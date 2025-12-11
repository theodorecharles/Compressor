import type { Request, Response, NextFunction } from 'express';
import logger from '../../logger.js';

interface HttpError extends Error {
  status?: number;
  code?: string;
}

export default function errorHandler(err: HttpError, _req: Request, res: Response, _next: NextFunction): void {
  logger.error(`API Error: ${err.message}`, { stack: err.stack });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: 'Validation Error',
      message: err.message,
    });
    return;
  }

  if (err.code === 'SQLITE_CONSTRAINT') {
    res.status(409).json({
      error: 'Conflict',
      message: 'A resource with this identifier already exists',
    });
    return;
  }

  // Default error response
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
}
