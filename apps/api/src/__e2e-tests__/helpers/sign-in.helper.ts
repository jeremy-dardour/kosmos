import request from 'supertest';

import type { CurrentUserDto } from '@/modules/user/dtos/output/current-user.dto';
import type { INestApplication } from '@nestjs/common';

/**
 * User-scoped routes resolve a persisted user and 401 without one; the real
 * client always establishes its session through `/users/me` first.
 */
export async function signIn(
  app: INestApplication,
  authorization: string,
): Promise<CurrentUserDto> {
  const response = await request(app.getHttpServer() as never)
    .get('/users/me')
    .set('Authorization', authorization)
    .expect(200);

  return response.body as CurrentUserDto;
}
