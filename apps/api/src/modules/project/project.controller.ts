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

import {
  ApiCommonErrorResponses,
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

@Controller('projects')
@ApiTags('projects')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@ApiUnauthorizedResponse()
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  @ApiOperation({
    summary: 'List projects',
    description:
      'V1 holds a single project; the client uses this to discover its id on first load.',
  })
  @ApiOkResponse({ type: [ProjectDto] })
  async findAll(): Promise<ProjectDto[]> {
    const projects = await this.projectService.findAll();

    return projects.map((project) => toProjectDto(project));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project' })
  @ApiOkResponse({ type: ProjectDto })
  @ApiNotFoundResponse()
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ProjectDto> {
    return toProjectDto(await this.projectService.findOne(id));
  }

  @Post()
  @ApiOperation({ summary: 'Create a project' })
  @ApiCreatedResponse({ type: ProjectDto })
  async create(@Body() dto: CreateProjectDto): Promise<ProjectDto> {
    return toProjectDto(await this.projectService.create(dto));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  @ApiOkResponse({ type: ProjectDto })
  @ApiNotFoundResponse()
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectDto> {
    return toProjectDto(await this.projectService.update(id, dto));
  }
}
