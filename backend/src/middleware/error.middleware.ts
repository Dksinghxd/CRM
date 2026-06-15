import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  errors?: unknown[];
}

export const createError = (
  message: string,
  statusCode: number,
  isOperational = true
): AppError => {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = isOperational;
  return error;
};

export const errorMiddleware = (
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const isOperational = err.isOperational ?? false;

  // Log error details
  if (statusCode >= 500) {
    console.error('🔴 Server Error:', {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      body: req.body,
      user: req.user,
    });
  } else {
    console.warn('🟡 Client Error:', {
      message: err.message,
      statusCode,
      url: req.url,
      method: req.method,
    });
  }

  // Prisma error handling
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as AppError & { code?: string; meta?: { target?: string[] } };

    if (prismaErr.code === 'P2002') {
      const field = prismaErr.meta?.target?.[0] ?? 'field';
      res.status(409).json({
        success: false,
        message: `A record with this ${field} already exists.`,
        code: 'DUPLICATE_ENTRY',
      });
      return;
    }

    if (prismaErr.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Record not found.',
        code: 'NOT_FOUND',
      });
      return;
    }

    if (prismaErr.code === 'P2003') {
      res.status(400).json({
        success: false,
        message: 'Foreign key constraint violation.',
        code: 'FOREIGN_KEY_ERROR',
      });
      return;
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      message: 'Invalid token.',
      code: 'INVALID_TOKEN',
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      message: 'Token expired.',
      code: 'TOKEN_EXPIRED',
    });
    return;
  }

  // Operational errors (safe to send to client)
  if (isOperational) {
    res.status(statusCode).json({
      success: false,
      message,
      ...(err.errors && { errors: err.errors }),
    });
    return;
  }

  // Unknown errors (don't leak details in production)
  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'Something went wrong. Please try again later.'
        : message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found.`,
    code: 'ROUTE_NOT_FOUND',
  });
};
