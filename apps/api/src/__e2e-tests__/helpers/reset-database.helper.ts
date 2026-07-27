import { SqlEntityManager } from '@mikro-orm/postgresql';

import { Project } from '@/database/entities/project.entity';
import { User } from '@/database/entities/user.entity';
import { Workstream } from '@/database/entities/workstream.entity';

import type { INestApplication } from '@nestjs/common';

/** A forked EntityManager — the ORM runs with `allowGlobalContext: false`. */
export function testEntityManager(app: INestApplication): SqlEntityManager {
  return app.get(SqlEntityManager).fork();
}

/**
 * Empties the project aggregate and users. The pointer is released first —
 * `workstream.current_step_id` is ON DELETE RESTRICT.
 */
export async function resetDatabase(em: SqlEntityManager): Promise<void> {
  await em.nativeUpdate(Workstream, {}, { currentStep: null });
  await em.nativeDelete(Project, {});
  await em.nativeDelete(User, {});
}
