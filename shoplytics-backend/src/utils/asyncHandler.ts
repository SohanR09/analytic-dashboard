import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown;

/** Forwards rejected promises from async route handlers to the error middleware. */
export const asyncHandler =
  (fn: AsyncFn): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
