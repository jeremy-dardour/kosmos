import z from 'zod';

export const jwtPayloadSchema = z.object({
  sub: z.string(),
  email: z.email().optional(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  picture: z.string().optional(),
  hd: z.string().optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
  iss: z.string().optional(),
  // eslint-disable-next-line unicorn/max-nested-calls
  aud: z.union([z.string(), z.array(z.string())]).optional(),
});
