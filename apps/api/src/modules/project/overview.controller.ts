import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@/app/auth/decorators';
import {
  ApiCommonErrorResponses,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@/app/decorators/api-problem-responses.decorator';
import { OverviewDto } from '@/modules/project/dtos/output/overview.dto';
import { OverviewService } from '@/modules/project/overview.service';

import type { User } from '@/database/entities/user.entity';

@Controller('projects/:projectId/overview')
@ApiTags('overview')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@ApiUnauthorizedResponse()
@ApiNotFoundResponse()
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  @Get()
  @ApiOperation({
    summary: 'Read the overview aggregate',
    description:
      'Project, groups, workstreams with inline steps and checklist items, and canonical user summaries — everything the overview screen needs in one call. Domain state and relationship IDs are computed server-side.',
  })
  @ApiOkResponse({ type: OverviewDto })
  async getOverview(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() currentUser: User,
  ): Promise<OverviewDto> {
    return this.overviewService.getOverview(projectId, currentUser);
  }
}
