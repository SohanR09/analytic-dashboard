import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validates (and coerces) request parts with Zod. Parsed `body` / `query` replace the originals so
 * controllers receive trimmed, typed, default-filled values. Params are validated only (not replaced)
 * so parent-router params such as `businessId` are preserved.
 */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    try {
      if (schemas.params) schemas.params.parse(req.params);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
