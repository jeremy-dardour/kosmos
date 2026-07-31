import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  ApiBadRequestResponse,
  ApiCommonErrorResponses,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@/app/decorators/api-problem-responses.decorator';
import { AdvanceWorkstreamDto } from '@/modules/project/dtos/input/advance-workstream.dto';
import { CreateStepDto } from '@/modules/project/dtos/input/create-step.dto';
import { CreateWorkstreamDto } from '@/modules/project/dtos/input/create-workstream.dto';
import { ReorderStepsDto } from '@/modules/project/dtos/input/reorder-steps.dto';
import { ReorderWorkstreamsDto } from '@/modules/project/dtos/input/reorder-workstreams.dto';
import { UpdatePipelineDto } from '@/modules/project/dtos/input/update-pipeline.dto';
import { UpdateWorkstreamDto } from '@/modules/project/dtos/input/update-workstream.dto';
import { WorkstreamDto } from '@/modules/project/dtos/output/workstream.dto';
import { StepService } from '@/modules/project/step.service';
import { WorkstreamService } from '@/modules/project/workstream.service';

/**
 * Reads go through the overview aggregate, so there is no GET here. Mutations
 * take a bare workstream id and are deliberately not project-scoped: V1 has one
 * project and no roles. A second project would need them scoped.
 */
@Controller()
@ApiTags('workstreams')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@ApiUnauthorizedResponse()
@ApiNotFoundResponse()
export class WorkstreamController {
  constructor(
    private readonly workstreamService: WorkstreamService,
    private readonly stepService: StepService,
  ) {}

  @Post('projects/:projectId/workstreams')
  @ApiOperation({ summary: 'Create a workstream' })
  @ApiCreatedResponse({ type: WorkstreamDto })
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateWorkstreamDto,
  ): Promise<WorkstreamDto> {
    return this.workstreamService.create(projectId, dto);
  }

  @Put('projects/:projectId/workstream-order')
  @ApiOperation({
    summary: "Reorder one group scope's workstreams",
    description:
      "The ids must be exactly the scope's live workstreams, in the new order. Complete workstreams trail them and are not returned.",
  })
  @ApiOkResponse({ type: [WorkstreamDto] })
  @ApiConflictResponse(
    "The submitted ids do not match the scope's live workstreams",
  )
  async reorder(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: ReorderWorkstreamsDto,
  ): Promise<WorkstreamDto[]> {
    return this.workstreamService.reorder(projectId, dto);
  }

  @Patch('workstreams/:id')
  @ApiOperation({ summary: 'Update a workstream' })
  @ApiOkResponse({ type: WorkstreamDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkstreamDto,
  ): Promise<WorkstreamDto> {
    return this.workstreamService.update(id, dto);
  }

  @Post('workstreams/:id/advance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Advance a workstream pipeline' })
  @ApiOkResponse({ type: WorkstreamDto })
  @ApiBadRequestResponse(
    'An outcome cannot be provided when starting a workstream',
  )
  @ApiConflictResponse('The workstream cannot advance from its current state')
  async advance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdvanceWorkstreamDto,
  ): Promise<WorkstreamDto> {
    return this.workstreamService.progress(id, dto);
  }

  @Post('workstreams/:id/steps')
  @ApiOperation({
    summary: 'Insert a step into the future pipeline',
    description: 'Shifts the steps at and after `position` down by one.',
  })
  @ApiCreatedResponse({ type: WorkstreamDto })
  @ApiConflictResponse('The position is not in the future zone')
  async createStep(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateStepDto,
  ): Promise<WorkstreamDto> {
    return this.stepService.create(id, dto);
  }

  @Put('workstreams/:id/step-order')
  @ApiOperation({
    summary: "Reorder the workstream's future steps",
    description:
      'The ids must be exactly the steps after the pointer, in the new order. Past and current steps never move.',
  })
  @ApiOkResponse({ type: WorkstreamDto })
  @ApiConflictResponse(
    "The submitted ids do not match the workstream's future steps",
  )
  async reorderSteps(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderStepsDto,
  ): Promise<WorkstreamDto> {
    return this.stepService.reorder(id, dto);
  }

  @Put('workstreams/:id/pipeline')
  @ApiOperation({ summary: 'Atomically replace the editable pipeline tail' })
  @ApiOkResponse({ type: WorkstreamDto })
  @ApiConflictResponse(
    'The pipeline is stale, frozen, or does not match the editable tail',
  )
  async updatePipeline(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePipelineDto,
  ): Promise<WorkstreamDto> {
    return this.workstreamService.updatePipeline(id, dto);
  }

  @Delete('workstreams/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a workstream',
    description: 'Cascades to its steps, checklist items and notes.',
  })
  @ApiNoContentResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.workstreamService.remove(id);
  }
}
