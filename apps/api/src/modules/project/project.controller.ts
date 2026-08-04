import {
  Body,
  Controller,
  Get,
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
import { CreateProjectDto } from '@/modules/project/dtos/input/create-project.dto';
import { UpdateProjectDto } from '@/modules/project/dtos/input/update-project.dto';
import {
  ProjectDto,
  toProjectDto,
} from '@/modules/project/dtos/output/project.dto';
import { ProjectService } from '@/modules/project/project.service';

import type { User } from '@/database/entities/user.entity';

@Controller('projects')
@UseInterceptors(ActorInterceptor)
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
  async findAll(@Actor() actor: User): Promise<ProjectDto[]> {
    const projects = await this.projectService.findAllForActor(actor);

    return projects.map((project) => toProjectDto(project));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project' })
  @ApiOkResponse({ type: ProjectDto })
  @ApiNotFoundResponse()
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Actor() actor: User,
  ): Promise<ProjectDto> {
    return toProjectDto(await this.projectService.findOne(id, actor));
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
    @Actor() actor: User,
  ): Promise<ProjectDto> {
    return toProjectDto(await this.projectService.create(dto, actor));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  @ApiOkResponse({ type: ProjectDto })
  @ApiNotFoundResponse()
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @Actor() actor: User,
  ): Promise<ProjectDto> {
    return toProjectDto(await this.projectService.update(id, dto, actor));
  }
}
