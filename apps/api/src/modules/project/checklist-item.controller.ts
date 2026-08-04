import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@/app/auth/decorators';
import {
  ApiCommonErrorResponses,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@/app/decorators/api-problem-responses.decorator';
import { UpdateChecklistItemDto } from '@/modules/project/dtos/input/update-checklist-item.dto';
import { ChecklistItemDto } from '@/modules/project/dtos/output/checklist-item.dto';
import { WorkstreamStructureService } from '@/modules/project/workstream-structure.service';

import type { User } from '@/database/entities/user.entity';

@Controller()
@ApiTags('checklist items')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@ApiUnauthorizedResponse()
@ApiNotFoundResponse()
export class ChecklistItemController {
  constructor(
    private readonly workstreamStructureService: WorkstreamStructureService,
  ) {}

  @Patch('checklist-items/:id')
  @ApiOperation({ summary: 'Rename a checklist item and/or set it done' })
  @ApiOkResponse({ type: ChecklistItemDto })
  @ApiConflictResponse('The checklist item belongs to a frozen past step')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChecklistItemDto,
    @CurrentUser() currentUser: User,
  ): Promise<ChecklistItemDto> {
    return this.workstreamStructureService.updateChecklistItem(
      id,
      dto,
      currentUser,
    );
  }

  @Delete('checklist-items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a checklist item',
    description: 'Renumbers the items that follow it.',
  })
  @ApiNoContentResponse()
  @ApiConflictResponse('The checklist item belongs to a frozen past step')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ): Promise<void> {
    await this.workstreamStructureService.removeChecklistItem(id, currentUser);
  }
}
