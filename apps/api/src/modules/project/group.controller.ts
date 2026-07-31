import {
  Body,
  Controller,
  Delete,
  Get,
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
  ApiCommonErrorResponses,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@/app/decorators/api-problem-responses.decorator';
import { CreateGroupDto } from '@/modules/project/dtos/input/create-group.dto';
import { ReorderGroupsDto } from '@/modules/project/dtos/input/reorder-groups.dto';
import { UpdateGroupDto } from '@/modules/project/dtos/input/update-group.dto';
import { GroupDto, toGroupDto } from '@/modules/project/dtos/output/group.dto';
import { GroupService } from '@/modules/project/group.service';

/**
 * Mutations take a bare group id and are deliberately not project-scoped: V1
 * has one project and no roles. A second project would need them scoped.
 */
@Controller()
@ApiTags('groups')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@ApiUnauthorizedResponse()
@ApiNotFoundResponse()
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Get('projects/:projectId/groups')
  @ApiOperation({ summary: "List a project's groups" })
  @ApiOkResponse({ type: [GroupDto] })
  async findAll(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<GroupDto[]> {
    const groups = await this.groupService.findAllByProject(projectId);

    return groups.map((group) => toGroupDto(group));
  }

  @Post('projects/:projectId/groups')
  @ApiOperation({ summary: 'Create a group' })
  @ApiCreatedResponse({ type: GroupDto })
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateGroupDto,
  ): Promise<GroupDto> {
    return toGroupDto(await this.groupService.create(projectId, dto));
  }

  @Put('projects/:projectId/group-order')
  @ApiOperation({
    summary: "Reorder the project's groups",
    description:
      "The ids must be exactly the project's groups, in the new order.",
  })
  @ApiOkResponse({ type: [GroupDto] })
  @ApiConflictResponse("The submitted ids do not match the project's groups")
  async reorder(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: ReorderGroupsDto,
  ): Promise<GroupDto[]> {
    const groups = await this.groupService.reorder(projectId, dto);

    return groups.map((group) => toGroupDto(group));
  }

  @Patch('groups/:id')
  @ApiOperation({ summary: 'Update a group' })
  @ApiOkResponse({ type: GroupDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGroupDto,
  ): Promise<GroupDto> {
    return toGroupDto(await this.groupService.update(id, dto));
  }

  @Delete('groups/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a group',
    description: 'Workstreams in the group are ungrouped, not deleted.',
  })
  @ApiNoContentResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.groupService.remove(id);
  }
}
