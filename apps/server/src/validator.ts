import type { ValidationTargets } from 'hono';
import { validator as describedValidator } from 'hono-openapi';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

export function validator<
  Target extends keyof ValidationTargets,
  Schema extends z.ZodType,
>(target: Target, schema: Schema) {
  return describedValidator(target, schema, (result) => {
    if (!result.success) {
      throw new HTTPException(400, {
        message: z.prettifyError(
          new z.ZodError(result.error as z.core.$ZodIssue[])
        ),
      });
    }
  });
}
