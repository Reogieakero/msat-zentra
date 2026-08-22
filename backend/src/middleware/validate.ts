import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

// Validates req.body / req.params / req.query against a Zod schema and replaces
// the property with the parsed result.
export function validate<T extends z.ZodTypeAny>(
  source: "body" | "params" | "query",
  schema: T
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(result.error);
    }
    (req as any)[source] = result.data;
    next();
  };
}
