import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
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
import { CreateChecklistItemDto } from '@/modules/project/dtos/input/create-checklist-item.dto';
import { UpdateStepDto } from '@/modules/project/dtos/input/update-step.dto';
import { ChecklistItemDto } from '@/modules/project/dtos/output/checklist-item.dto';
import { StepDto } from '@/modules/project/dtos/output/step.dto';
import { WorkstreamDto } from '@/modules/project/dtos/output/workstream.dto';
import { StepService } from '@/modules/project/step.service';

@Controller()
@ApiTags('steps')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@ApiUnauthorizedResponse()
@ApiNotFoundResponse()
export class StepController {
  constructor(
    private readonly stepService: StepService,
    private readonly checklistItemService: ChecklistItemService,
  ) {}

  @Patch('steps/:id')
  @ApiOperation({
    summary: 'Edit a step',
    description:
      'Current and future steps only. `blocked` is only meaningful on the current step.',
  })
  @ApiOkResponse({ type: StepDto })
  @ApiConflictResponse('The step is a past step and is frozen')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStepDto,
  ): Promise<StepDto> {
    return this.stepService.update(id, dto);
  }

  @Delete('steps/:id')
  @ApiOperation({
    summary: 'Delete a future step',
    description: 'Renumbers the steps that follow it.',
  })
  @ApiOkResponse({ type: WorkstreamDto })
  @ApiConflictResponse('The step is the current step or a frozen past step')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<WorkstreamDto> {
    return this.stepService.remove(id);
  }

  @Post('steps/:stepId/checklist-items')
  @ApiOperation({
    summary: 'Add a checklist item to a step',
    description: "Appended after the step's existing items.",
  })
  @ApiCreatedResponse({ type: ChecklistItemDto })
  @ApiConflictResponse('The step is a past step and is frozen')
  async createChecklistItem(
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body() dto: CreateChecklistItemDto,
  ): Promise<ChecklistItemDto> {
    return this.checklistItemService.create(stepId, dto);
  }
}
