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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@/app/auth/decorators';
import {
  ApiCommonErrorResponses,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@/app/decorators/api-problem-responses.decorator';
import { CreateProjectDto } from '@/modules/project/dtos/input/create-project.dto';
import { TransferOwnerDto } from '@/modules/project/dtos/input/transfer-owner.dto';
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

  @Post(':id/transfer-ownership')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Transfer project ownership to a joined member',
    description: 'Owner only. Both parties keep their member rows.',
  })
  @ApiOkResponse({ type: ProjectDto })
  @ApiNotFoundResponse()
  @ApiForbiddenResponse('Only the project owner can transfer ownership')
  @ApiConflictResponse('The target is not a joined member of this project')
  async transferOwnership(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferOwnerDto,
    @CurrentUser() currentUser: User,
  ): Promise<ProjectDto> {
    return toProjectDto(
      await this.projectService.transferOwnership(id, dto, currentUser),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete a project',
    description:
      'Owner only. Members lose access instantly; the owner keeps a restorable entry in their project list.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiForbiddenResponse('Only the project owner can delete the project')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ): Promise<void> {
    await this.projectService.softDelete(id, currentUser);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restore a soft-deleted project',
    description:
      'Owner only — the single write that may target a deleted project.',
  })
  @ApiOkResponse({ type: ProjectDto })
  @ApiNotFoundResponse()
  @ApiForbiddenResponse('Only the project owner can restore the project')
  @ApiConflictResponse(
    'The project is not deleted, or the owned-project limit is reached',
  )
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ): Promise<ProjectDto> {
    return toProjectDto(await this.projectService.restore(id, currentUser));
  }
}
