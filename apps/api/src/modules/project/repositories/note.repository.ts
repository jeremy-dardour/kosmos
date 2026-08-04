import { EntityRepository } from '@mikro-orm/core';
import { SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Note } from '@/database/entities/note.entity';
import { Step } from '@/database/entities/step.entity';
import { Workstream } from '@/database/entities/workstream.entity';
import { memberProject } from '@/modules/project/repositories/membership.query';

@Injectable()
export class NoteRepository extends EntityRepository<Note> {
  constructor(em: SqlEntityManager) {
    super(em, Note);
  }

  async findByWorkstream(
    workstreamId: string,
    actorId: string,
  ): Promise<Note[]> {
    await this.em.findOneOrFail(Workstream, {
      id: workstreamId,
      project: memberProject(actorId),
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

  async findStepOrFail(stepId: string, actorId: string): Promise<Step> {
    return this.em.findOneOrFail(Step, {
      id: stepId,
      workstream: { project: memberProject(actorId) },
    });
  }

  async findDetailsOrFail(id: string, actorId: string): Promise<Note> {
    return this.findOneOrFail(
      { id, step: { workstream: { project: memberProject(actorId) } } },
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
