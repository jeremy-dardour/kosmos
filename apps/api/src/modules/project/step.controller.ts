import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { ActorInterceptor } from '@/app/auth/actor.interceptor';
import { Actor } from '@/app/auth/decorators';
import {
  ApiCommonErrorResponses,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@/app/decorators/api-problem-responses.decorator';
import { CreateChecklistItemDto } from '@/modules/project/dtos/input/create-checklist-item.dto';
import { UpdateStepDto } from '@/modules/project/dtos/input/update-step.dto';
import { ChecklistItemDto } from '@/modules/project/dtos/output/checklist-item.dto';
import { StepDto } from '@/modules/project/dtos/output/step.dto';
import { WorkstreamDto } from '@/modules/project/dtos/output/workstream.dto';
import { WorkstreamStructureService } from '@/modules/project/workstream-structure.service';

import type { User } from '@/database/entities/user.entity';

@Controller()
@UseInterceptors(ActorInterceptor)
@ApiTags('steps')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@ApiUnauthorizedResponse()
@ApiNotFoundResponse()
export class StepController {
  constructor(
    private readonly workstreamStructureService: WorkstreamStructureService,
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
    @Actor() actor: User,
  ): Promise<StepDto> {
    return this.workstreamStructureService.updateStep(id, dto, actor);
  }

  @Delete('steps/:id')
  @ApiOperation({
    summary: 'Delete a future step',
    description: 'Renumbers the steps that follow it.',
  })
  @ApiOkResponse({ type: WorkstreamDto })
  @ApiConflictResponse('The step is the current step or a frozen past step')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Actor() actor: User,
  ): Promise<WorkstreamDto> {
    return this.workstreamStructureService.removeStep(id, actor);
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
    @Actor() actor: User,
  ): Promise<ChecklistItemDto> {
    return this.workstreamStructureService.createChecklistItem(
      stepId,
      dto,
      actor,
    );
  }
}
