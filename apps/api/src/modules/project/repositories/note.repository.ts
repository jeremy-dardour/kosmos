import { EntityRepository } from '@mikro-orm/core';
import { SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Note } from '@/database/entities/note.entity';
import { Step } from '@/database/entities/step.entity';
import { Workstream } from '@/database/entities/workstream.entity';

@Injectable()
export class NoteRepository extends EntityRepository<Note> {
  constructor(em: SqlEntityManager) {
    super(em, Note);
  }

  async findByWorkstream(workstreamId: string): Promise<Note[]> {
    await this.em.findOneOrFail(Workstream, { id: workstreamId });

    return this.em.find(
      Note,
      { step: { workstream: workstreamId } },
      {
        populate: ['step', 'author'],
        orderBy: { createdAt: 'DESC', id: 'DESC' },
      },
    );
  }

  async findStepOrFail(stepId: string): Promise<Step> {
    return this.em.findOneOrFail(Step, { id: stepId });
  }

  async findDetailsOrFail(id: string): Promise<Note> {
    return this.findOneOrFail(
      { id },
      { populate: ['step', 'author'], refresh: true },
    );
  }

  async save(note: Note): Promise<void> {
    this.em.persist(note);
    await this.em.flush();
  }

  async removeAndFlush(note: Note): Promise<void> {
    this.em.remove(note);
    await this.em.flush();
  }
}
