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
    currentUser: User,
  ): Promise<NoteDto[]> {
    const notes = await this.noteRepository.findByWorkstream(
      workstreamId,
      currentUser.id,
    );

    return notes.map((note) => toNoteDto(note));
  }

  async create(
    stepId: string,
    currentUser: User,
    dto: CreateNoteDto,
  ): Promise<NoteDto> {
    const step = await this.noteRepository.findStepOrFail(
      stepId,
      currentUser.id,
    );
    const note = new Note();
    note.step = step;
    note.author = currentUser;
    note.content = dto.content;

    await this.noteRepository.save(note);

    return toNoteDto(note);
  }

  async update(
    id: string,
    currentUser: User,
    dto: UpdateNoteDto,
  ): Promise<NoteDto> {
    const note = await this.noteRepository.findDetailsOrFail(
      id,
      currentUser.id,
    );
    this.assertAuthor(note, currentUser.id);
    note.content = dto.content;

    await this.noteRepository.save(note);

    return toNoteDto(note);
  }

  async remove(id: string, currentUser: User): Promise<void> {
    const note = await this.noteRepository.findDetailsOrFail(
      id,
      currentUser.id,
    );
    this.assertAuthor(note, currentUser.id);

    await this.noteRepository.removeAndFlush(note);
  }

  private assertAuthor(note: Note, currentUserId: string): void {
    if (note.author?.id !== currentUserId) {
      throw new ProblemDetailsException(
        HttpStatus.FORBIDDEN,
        'not-note-author',
        'Only the note author can change this note',
      );
    }
  }
}
