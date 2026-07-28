import { Body, Controller, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  ApiCommonErrorResponses,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@/app/decorators/api-problem-responses.decorator';
import { ChecklistItemService } from '@/modules/project/checklist-item.service';
import { ToggleChecklistItemDto } from '@/modules/project/dtos/input/toggle-checklist-item.dto';
import { ChecklistItemDto } from '@/modules/project/dtos/output/checklist-item.dto';

@Controller()
@ApiTags('checklist items')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@ApiUnauthorizedResponse()
@ApiNotFoundResponse()
export class ChecklistItemController {
  constructor(private readonly checklistItemService: ChecklistItemService) {}

  @Patch('checklist-items/:id')
  @ApiOperation({ summary: 'Set a checklist item done or undone' })
  @ApiOkResponse({ type: ChecklistItemDto })
  @ApiConflictResponse('The checklist item belongs to a frozen past step')
  async toggle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleChecklistItemDto,
  ): Promise<ChecklistItemDto> {
    return this.checklistItemService.toggle(id, dto);
  }
}
