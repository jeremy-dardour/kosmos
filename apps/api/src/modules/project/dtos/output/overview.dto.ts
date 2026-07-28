import { ApiProperty } from '@nestjs/swagger';

import { GroupDto } from '@/modules/project/dtos/output/group.dto';
import { ProjectDto } from '@/modules/project/dtos/output/project.dto';
import { UserSummaryDto } from '@/modules/project/dtos/output/user-summary.dto';
import { WorkstreamDto } from '@/modules/project/dtos/output/workstream.dto';

/** The single aggregate read behind the overview screen. */
export class OverviewDto {
  @ApiProperty({ type: ProjectDto })
  project!: ProjectDto;

  @ApiProperty({ type: [GroupDto] })
  groups!: GroupDto[];

  @ApiProperty({ type: [WorkstreamDto] })
  workstreams!: WorkstreamDto[];

  @ApiProperty({
    type: [UserSummaryDto],
    description:
      'Canonical display data for every user, keyed by owner IDs elsewhere in the aggregate',
  })
  users!: UserSummaryDto[];
}
