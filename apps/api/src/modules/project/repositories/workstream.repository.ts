import { SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Workstream } from '@/database/entities/workstream.entity';

const WORKSTREAM_POPULATE = [
  'owner',
  'group',
  'currentStep',
  'steps',
  'steps.owner',
  'steps.checklistItems',
] as const;

@Injectable()
export class WorkstreamRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async findOne(id: string): Promise<Workstream> {
    return this.em.findOneOrFail(Workstream, { id });
  }

  async findDetails(id: string): Promise<Workstream> {
    return this.em.findOneOrFail(
      Workstream,
      { id },
      { populate: [...WORKSTREAM_POPULATE], refresh: true },
    );
  }

  async save(workstream: Workstream): Promise<void> {
    this.em.persist(workstream);
    await this.em.flush();
  }

  async remove(id: string): Promise<void> {
    await this.em.transactional(async (em) => {
      const workstream = await em.findOneOrFail(Workstream, { id });

      // The current-step FK is restrictive, so release it before cascading.
      workstream.currentStep = null;
      await em.flush();

      em.remove(workstream);
    });
  }
}
