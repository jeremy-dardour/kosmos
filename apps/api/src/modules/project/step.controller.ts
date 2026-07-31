import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
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
import { UpdateStepDto } from '@/modules/project/dtos/input/update-step.dto';
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
  constructor(private readonly stepService: StepService) {}

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
}
