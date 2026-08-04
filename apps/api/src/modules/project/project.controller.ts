import {
  Body,
  Controller,
  Get,
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

import { CurrentUser } from '@/app/auth/decorators';
import {
  ApiCommonErrorResponses,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@/app/decorators/api-problem-responses.decorator';
import { CreateProjectDto } from '@/modules/project/dtos/input/create-project.dto';
import { UpdateProjectDto } from '@/modules/project/dtos/input/update-project.dto';
import {
  ProjectDto,
  toProjectDto,
} from '@/modules/project/dtos/output/project.dto';
import { ProjectService } from '@/modules/project/project.service';

import type { User } from '@/database/entities/user.entity';

@Controller('projects')
@ApiTags('projects')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@ApiUnauthorizedResponse()
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  @ApiOperation({
    summary: 'List the projects the current user belongs to',
    description:
      'Projects the user is a member of, plus their own soft-deleted ones.',
  })
  @ApiOkResponse({ type: [ProjectDto] })
  async findAll(@CurrentUser() currentUser: User): Promise<ProjectDto[]> {
    const projects = await this.projectService.findAllForUser(currentUser);

    return projects.map((project) => toProjectDto(project));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project' })
  @ApiOkResponse({ type: ProjectDto })
  @ApiNotFoundResponse()
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ): Promise<ProjectDto> {
    return toProjectDto(await this.projectService.findOne(id, currentUser));
  }

  @Post()
  @ApiOperation({
    summary: 'Create a project',
    description: 'The current user becomes its owner and first member.',
  })
  @ApiCreatedResponse({ type: ProjectDto })
  @ApiConflictResponse('The owned-project limit is reached')
  async create(
    @Body() dto: CreateProjectDto,
    @CurrentUser() currentUser: User,
  ): Promise<ProjectDto> {
    return toProjectDto(await this.projectService.create(dto, currentUser));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  @ApiOkResponse({ type: ProjectDto })
  @ApiNotFoundResponse()
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() currentUser: User,
  ): Promise<ProjectDto> {
    return toProjectDto(await this.projectService.update(id, dto, currentUser));
  }
}
