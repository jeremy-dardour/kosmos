import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { ActorResolutionService } from '@/app/auth/actor-resolution.service';
import {
  ApiCommonErrorResponses,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@/app/decorators/api-problem-responses.decorator';
import { CreateNoteDto } from '@/modules/project/dtos/input/create-note.dto';
import { UpdateNoteDto } from '@/modules/project/dtos/input/update-note.dto';
import { NoteDto } from '@/modules/project/dtos/output/note.dto';
import { NoteService } from '@/modules/project/note.service';

import type { AuthenticatedRequest } from '@/app/auth/types/token.types';

@Controller()
@ApiTags('notes')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@ApiUnauthorizedResponse()
@ApiNotFoundResponse()
export class NoteController {
  constructor(
    private readonly noteService: NoteService,
    private readonly actorResolution: ActorResolutionService,
  ) {}

  @Get('workstreams/:workstreamId/notes')
  @ApiOperation({ summary: 'List notes for a workstream' })
  @ApiOkResponse({ type: [NoteDto] })
  async getWorkstreamNotes(
    @Param('workstreamId', ParseUUIDPipe) workstreamId: string,
  ): Promise<NoteDto[]> {
    return this.noteService.getWorkstreamNotes(workstreamId);
  }

  @Post('steps/:stepId/notes')
  @ApiOperation({ summary: 'Add a note to a step' })
  @ApiCreatedResponse({ type: NoteDto })
  async create(
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body() dto: CreateNoteDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<NoteDto> {
    const actor = await this.actorResolution.resolve(request.user);

    return this.noteService.create(stepId, actor.id, dto);
  }

  @Patch('notes/:id')
  @ApiOperation({ summary: 'Edit a note authored by the current user' })
  @ApiOkResponse({ type: NoteDto })
  @ApiForbiddenResponse('Only the note author can edit it')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNoteDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<NoteDto> {
    const actor = await this.actorResolution.resolve(request.user);

    return this.noteService.update(id, actor.id, dto);
  }

  @Delete('notes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a note authored by the current user' })
  @ApiNoContentResponse()
  @ApiForbiddenResponse('Only the note author can delete it')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    const actor = await this.actorResolution.resolve(request.user);

    await this.noteService.remove(id, actor.id);
  }
}
