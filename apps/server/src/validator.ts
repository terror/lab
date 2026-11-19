import type { ValidationTargets } from 'hono';
import { validator as describedValidator } from 'hono-openapi';
import { bodyLimit } from 'hono/body-limit';
import { every } from 'hono/combine';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

export const BODY_BYTES = 1_000_000;

export function validator<
  Target extends keyof ValidationTargets,
  Schema extends z.ZodType,
>(target: Target, schema: Schema, maxSize = BODY_BYTES) {
  const validate = describedValidator(target, schema, (result) => {
    if (!result.success) {
      throw new HTTPException(400, {
        message: z.prettifyError(
          new z.ZodError(result.error as z.core.$ZodIssue[])
        ),
      });
    }
  });

  if (target !== 'form' && target !== 'json') {
    return validate;
  }

  const limit = bodyLimit({
    maxSize,
    onError: () => {
      throw new HTTPException(413, { message: 'Request body is too large' });
    },
  });

  return Object.assign(every(limit, validate), validate);
}

export const positiveId = z.coerce.number().int().positive();

export const idParam = validator('param', z.object({ id: positiveId }));

export const keyParam = validator('param', z.object({ id: z.string().min(1) }));

export const uuidParam = validator('param', z.object({ id: z.uuid() }));
