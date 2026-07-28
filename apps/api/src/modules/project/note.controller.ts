import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  ApiCommonErrorResponses,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@/app/decorators/api-problem-responses.decorator';
import { NoteDto } from '@/modules/project/dtos/output/note.dto';
import { NoteService } from '@/modules/project/note.service';

@Controller()
@ApiTags('notes')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@ApiUnauthorizedResponse()
@ApiNotFoundResponse()
export class NoteController {
  constructor(private readonly noteService: NoteService) {}

  @Get('workstreams/:workstreamId/notes')
  @ApiOperation({ summary: 'List notes for a workstream' })
  @ApiOkResponse({ type: [NoteDto] })
  async getWorkstreamNotes(
    @Param('workstreamId', ParseUUIDPipe) workstreamId: string,
  ): Promise<NoteDto[]> {
    return this.noteService.getWorkstreamNotes(workstreamId);
  }
}
