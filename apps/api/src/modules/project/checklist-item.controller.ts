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

import {
  ApiCommonErrorResponses,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@/app/decorators/api-problem-responses.decorator';
import { ChecklistItemService } from '@/modules/project/checklist-item.service';
import { UpdateChecklistItemDto } from '@/modules/project/dtos/input/update-checklist-item.dto';
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
  @ApiOperation({ summary: 'Rename a checklist item and/or set it done' })
  @ApiOkResponse({ type: ChecklistItemDto })
  @ApiConflictResponse('The checklist item belongs to a frozen past step')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChecklistItemDto,
  ): Promise<ChecklistItemDto> {
    return this.checklistItemService.update(id, dto);
  }

  @Delete('checklist-items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a checklist item',
    description: 'Renumbers the items that follow it.',
  })
  @ApiNoContentResponse()
  @ApiConflictResponse('The checklist item belongs to a frozen past step')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.checklistItemService.remove(id);
  }
}
