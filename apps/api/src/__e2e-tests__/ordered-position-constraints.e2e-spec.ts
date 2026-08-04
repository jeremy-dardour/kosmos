import { createTestApp } from '@/__e2e-tests__/helpers/create-app.helper';
import {
  resetDatabase,
  testEntityManager,
} from '@/__e2e-tests__/helpers/reset-database.helper';
import { Project } from '@/database/entities/project.entity';
import { Step } from '@/database/entities/step.entity';
import { Workstream } from '@/database/entities/workstream.entity';

import type { SqlEntityManager } from '@mikro-orm/postgresql';
import type { INestApplication } from '@nestjs/common';

describe('ordered position constraints', () => {
  let app: INestApplication;
  let em: SqlEntityManager;

  beforeEach(async () => {
    app = await createTestApp({});
    em = testEntityManager(app);
    await resetDatabase(em);
  });

  afterEach(async () => {
    await app.close();
  });

  it('defers Step position uniqueness until a reorder transaction commits', async () => {
    const project = em.create(Project, { name: 'Wedding Prep' });
    const workstream = em.create(Workstream, {
      project,
      position: 0,
      name: 'Catering',
      icon: '🍽️',
    });
    const first = em.create(Step, {
      workstream,
      position: 1,
      name: 'Research',
    });
    const second = em.create(Step, {
      workstream,
      position: 2,
      name: 'Book',
    });
    await em.flush();

    await em.transactional(async (transaction) => {
      const [lockedFirst, lockedSecond] = await Promise.all([
        transaction.findOneOrFail(Step, first.id),
        transaction.findOneOrFail(Step, second.id),
      ]);

      lockedFirst.position = 2;
      lockedSecond.position = 1;
      await transaction.flush();
    });

    const reordered = await em.find(
      Step,
      { workstream: workstream.id },
      { orderBy: { position: 'asc' }, refresh: true },
    );
    expect(reordered.map((step) => step.name)).toEqual(['Book', 'Research']);
  });

  it('rejects a duplicate position within the ungrouped Workstream scope', async () => {
    const project = em.create(Project, { name: 'Wedding Prep' });
    em.create(Workstream, {
      project,
      position: 0,
      name: 'Catering',
      icon: '🍽️',
    });
    em.create(Workstream, {
      project,
      position: 0,
      name: 'Flowers',
      icon: '💐',
    });

    await expect(em.flush()).rejects.toThrow(
      'workstream_project_id_group_id_position_unique',
    );
  });
});
