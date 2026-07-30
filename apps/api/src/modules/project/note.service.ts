import { HttpStatus, Injectable } from '@nestjs/common';

import { Note } from '@/database/entities/note.entity';
import { UserRepository } from '@/database/repositories/user.repository';
import { CreateNoteDto } from '@/modules/project/dtos/input/create-note.dto';
import { UpdateNoteDto } from '@/modules/project/dtos/input/update-note.dto';
import { NoteDto, toNoteDto } from '@/modules/project/dtos/output/note.dto';
import { NoteRepository } from '@/modules/project/repositories/note.repository';
import { ProblemDetailsException } from '@/shared/exceptions/problem-details.exception';

@Injectable()
export class NoteService {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async getWorkstreamNotes(workstreamId: string): Promise<NoteDto[]> {
    const notes = await this.noteRepository.findByWorkstream(workstreamId);

    return notes.map((note) => toNoteDto(note));
  }

  async create(
    stepId: string,
    actorId: string,
    dto: CreateNoteDto,
  ): Promise<NoteDto> {
    const [step, actor] = await Promise.all([
      this.noteRepository.findStepOrFail(stepId),
      this.userRepository.findOneOrFail(actorId),
    ]);
    const note = new Note();
    note.step = step;
    note.author = actor;
    note.content = dto.content;

    await this.noteRepository.save(note);

    return toNoteDto(note);
  }

  async update(
    id: string,
    actorId: string,
    dto: UpdateNoteDto,
  ): Promise<NoteDto> {
    const note = await this.noteRepository.findDetailsOrFail(id);
    this.assertAuthor(note, actorId);
    note.content = dto.content;

    await this.noteRepository.save(note);

    return toNoteDto(note);
  }

  async remove(id: string, actorId: string): Promise<void> {
    const note = await this.noteRepository.findDetailsOrFail(id);
    this.assertAuthor(note, actorId);

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
