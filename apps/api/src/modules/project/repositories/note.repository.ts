import { SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Note } from '@/database/entities/note.entity';
import { Workstream } from '@/database/entities/workstream.entity';

@Injectable()
export class NoteRepository {
  constructor(private readonly em: SqlEntityManager) {}

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
}
