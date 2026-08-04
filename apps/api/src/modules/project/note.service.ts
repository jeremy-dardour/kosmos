import { HttpStatus, Injectable } from '@nestjs/common';

import { Note } from '@/database/entities/note.entity';
import { CreateNoteDto } from '@/modules/project/dtos/input/create-note.dto';
import { UpdateNoteDto } from '@/modules/project/dtos/input/update-note.dto';
import { NoteDto, toNoteDto } from '@/modules/project/dtos/output/note.dto';
import { NoteRepository } from '@/modules/project/repositories/note.repository';
import { ProblemDetailsException } from '@/shared/exceptions/problem-details.exception';

import type { User } from '@/database/entities/user.entity';

@Injectable()
export class NoteService {
  constructor(private readonly noteRepository: NoteRepository) {}

  async getWorkstreamNotes(
    workstreamId: string,
    actor: User,
  ): Promise<NoteDto[]> {
    const notes = await this.noteRepository.findByWorkstream(
      workstreamId,
      actor.id,
    );

    return notes.map((note) => toNoteDto(note));
  }

  async create(
    stepId: string,
    actor: User,
    dto: CreateNoteDto,
  ): Promise<NoteDto> {
    const step = await this.noteRepository.findStepOrFail(stepId, actor.id);
    const note = new Note();
    note.step = step;
    note.author = actor;
    note.content = dto.content;

    await this.noteRepository.save(note);

    return toNoteDto(note);
  }

  async update(id: string, actor: User, dto: UpdateNoteDto): Promise<NoteDto> {
    const note = await this.noteRepository.findDetailsOrFail(id, actor.id);
    this.assertAuthor(note, actor.id);
    note.content = dto.content;

    await this.noteRepository.save(note);

    return toNoteDto(note);
  }

  async remove(id: string, actor: User): Promise<void> {
    const note = await this.noteRepository.findDetailsOrFail(id, actor.id);
    this.assertAuthor(note, actor.id);

    await this.noteRepository.removeAndFlush(note);
  }

  private assertAuthor(note: Note, actorId: string): void {
    if (note.author?.id !== actorId) {
      throw new ProblemDetailsException(
        HttpStatus.FORBIDDEN,
        'not-note-author',
        'Only the note author can change this note',
      );
    }
  }
}
