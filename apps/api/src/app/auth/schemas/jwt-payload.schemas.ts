import z from 'zod';

export const jwtPayloadSchema = z.object({
  sub: z.string(),
  email: z.email().optional(),
  name: z.string().optional(),
  preferred_username: z.string().optional(),
  scp: z.string().optional(),
  roles: z.array(z.string()).optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
  nbf: z.number().optional(),
  iss: z.string().optional(),
  // eslint-disable-next-line unicorn/max-nested-calls
  aud: z.union([z.string(), z.array(z.string())]).optional(),
});
