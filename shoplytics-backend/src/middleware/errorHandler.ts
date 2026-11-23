import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

export const notFound: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);

  let status = 500;
  let message = 'Internal server error';
  let details: unknown;

  if (err instanceof ApiError) {
    status = err.statusCode;
    message = err.message;
    details = err.details;
    if (err.headers) for (const [k, v] of Object.entries(err.headers)) res.setHeader(k, v);
  } else if (err instanceof ZodError) {
    status = 400;
    message = 'Validation failed';
    details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        status = 409;
        const target = (err.meta?.target as string[] | string | undefined) ?? [];
        const fields = (Array.isArray(target) ? target : [target]).filter((f) => f && f !== 'businessId');
        message = fields.length ? `A record with this ${fields.join(', ')} already exists` : 'Duplicate record';
        break;
      }
      case 'P2025':
        status = 404;
        message = 'Record not found';
        break;
      case 'P2023':
        status = 400;
        message = 'Invalid identifier';
        break;
      case 'P2034':
        status = 409;
        message = 'The record was modified by another request, please retry';
        break;
      default:
        break;
    }
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    message = 'Request body too large';
  }

  if (status >= 500) console.error(err);

  res.status(status).json({
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(!env.isProduction && status >= 500 ? { stack: err?.stack } : {}),
  });
};
