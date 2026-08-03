import { Injectable } from '@nestjs/common';

import { toGroupDto } from '@/modules/project/dtos/output/group.dto';
import { toProjectDto } from '@/modules/project/dtos/output/project.dto';
import { toUserSummaryDto } from '@/modules/project/dtos/output/user-summary.dto';
import { toWorkstreamDto } from '@/modules/project/dtos/output/workstream.dto';
import { OverviewRepository } from '@/modules/project/repositories/overview.repository';

import type { OverviewDto } from '@/modules/project/dtos/output/overview.dto';

/**
 * The overview read model: one aggregate response, every derived status
 * computed here rather than stored (ADR 0005). Note bodies stay out — the
 * aggregate carries only per-step counts.
 */
@Injectable()
export class OverviewService {
  constructor(private readonly overviewRepository: OverviewRepository) {}

  async getOverview(projectId: string): Promise<OverviewDto> {
    const { project, groups, workstreams, users, noteCounts } =
      await this.overviewRepository.load(projectId);

    return {
      project: toProjectDto(project),
      groups: groups.map((group) => toGroupDto(group)),
      workstreams: workstreams.map((workstream) =>
        toWorkstreamDto(workstream, noteCounts),
      ),
      users: users.map((user) => toUserSummaryDto(user)),
    };
  }
}
