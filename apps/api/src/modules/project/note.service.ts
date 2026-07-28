import { Injectable } from '@nestjs/common';

import { NoteDto, toNoteDto } from '@/modules/project/dtos/output/note.dto';
import { NoteRepository } from '@/modules/project/repositories/note.repository';

@Injectable()
export class NoteService {
  constructor(private readonly noteRepository: NoteRepository) {}

  async getWorkstreamNotes(workstreamId: string): Promise<NoteDto[]> {
    const notes = await this.noteRepository.findByWorkstream(workstreamId);

    return notes.map((note) => toNoteDto(note));
  }
}
