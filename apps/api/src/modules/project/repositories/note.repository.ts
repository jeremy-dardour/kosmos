import { EntityRepository } from '@mikro-orm/core';
import { SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Note } from '@/database/entities/note.entity';
import { Step } from '@/database/entities/step.entity';
import { Workstream } from '@/database/entities/workstream.entity';
import { projectVisibleTo } from '@/modules/project/repositories/membership.query';

@Injectable()
export class NoteRepository extends EntityRepository<Note> {
  constructor(em: SqlEntityManager) {
    super(em, Note);
  }

  async findByWorkstream(
    workstreamId: string,
    currentUserId: string,
  ): Promise<Note[]> {
    await this.em.findOneOrFail(Workstream, {
      id: workstreamId,
      project: projectVisibleTo(currentUserId),
    });

    return this.em.find(
      Note,
      { step: { workstream: workstreamId } },
      {
        populate: ['step', 'author'],
        orderBy: { createdAt: 'DESC', id: 'DESC' },
      },
    );
  }

  async findStepOrFail(stepId: string, currentUserId: string): Promise<Step> {
    return this.em.findOneOrFail(Step, {
      id: stepId,
      workstream: { project: projectVisibleTo(currentUserId) },
    });
  }

  async findDetailsOrFail(id: string, currentUserId: string): Promise<Note> {
    return this.findOneOrFail(
      {
        id,
        step: { workstream: { project: projectVisibleTo(currentUserId) } },
      },
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
