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
import { CreateWorkstreamDto } from '@/modules/project/dtos/input/create-workstream.dto';
import { UpdatePipelineDto } from '@/modules/project/dtos/input/update-pipeline.dto';
import { UpdateWorkstreamDto } from '@/modules/project/dtos/input/update-workstream.dto';
import { WorkstreamDto } from '@/modules/project/dtos/output/workstream.dto';
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
  constructor(private readonly workstreamService: WorkstreamService) {}

  @Post('projects/:projectId/workstreams')
  @ApiOperation({ summary: 'Create a workstream' })
  @ApiCreatedResponse({ type: WorkstreamDto })
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateWorkstreamDto,
  ): Promise<WorkstreamDto> {
    return this.workstreamService.create(projectId, dto);
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
