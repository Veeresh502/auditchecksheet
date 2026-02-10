import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index';

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

export function errorHandler(err: ApiError, req: AuthRequest, res: Response, next: NextFunction): void {
  console.error('Error:', err);

  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  const code = err.code || 'INTERNAL_ERROR';

  res.status(status).json({
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
    },
  });
}

export function asyncHandler(fn: Function) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
