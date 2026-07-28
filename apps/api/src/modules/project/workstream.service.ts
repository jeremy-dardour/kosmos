import { Injectable, NotFoundException } from '@nestjs/common';

import { Group } from '@/database/entities/group.entity';
import { User } from '@/database/entities/user.entity';
import { Workstream } from '@/database/entities/workstream.entity';
import { UserRepository } from '@/database/repositories/user.repository';
import {
  toWorkstreamDto,
  WorkstreamDto,
} from '@/modules/project/dtos/output/workstream.dto';
import { GroupRepository } from '@/modules/project/repositories/group.repository';
import { ProjectRepository } from '@/modules/project/repositories/project.repository';
import { WorkstreamRepository } from '@/modules/project/repositories/workstream.repository';

import type { CreateWorkstreamDto } from '@/modules/project/dtos/input/create-workstream.dto';
import type { UpdateWorkstreamDto } from '@/modules/project/dtos/input/update-workstream.dto';

/**
 * Owns the Workstream aggregate — the only place allowed to write `startedAt`,
 * `completedAt`, `currentStep` or a step's outcome (ADR 0005).
 */
@Injectable()
export class WorkstreamService {
  constructor(
    private readonly workstreamRepository: WorkstreamRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly groupRepository: GroupRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async create(
    projectId: string,
    dto: CreateWorkstreamDto,
  ): Promise<WorkstreamDto> {
    const project = await this.projectRepository.findOne(projectId);

    const workstream = new Workstream();
    workstream.project = project;
    workstream.name = dto.name;
    workstream.icon = dto.icon;
    workstream.group = dto.groupId
      ? await this.findGroupInProject(dto.groupId, projectId)
      : null;
    workstream.owner = dto.ownerId ? await this.findUser(dto.ownerId) : null;

    await this.workstreamRepository.save(workstream);

    return this.buildDto(workstream.id);
  }

  async update(id: string, dto: UpdateWorkstreamDto): Promise<WorkstreamDto> {
    const workstream = await this.workstreamRepository.findOne(id);

    if (dto.name !== undefined) {
      workstream.name = dto.name;
    }
    if (dto.icon !== undefined) {
      workstream.icon = dto.icon;
    }
    if (dto.groupId !== undefined) {
      workstream.group = dto.groupId
        ? await this.findGroupInProject(dto.groupId, workstream.project.id)
        : null;
    }
    if (dto.ownerId !== undefined) {
      workstream.owner = dto.ownerId ? await this.findUser(dto.ownerId) : null;
    }

    await this.workstreamRepository.save(workstream);

    return this.buildDto(id);
  }

  async remove(id: string): Promise<void> {
    await this.workstreamRepository.remove(id);
  }

  private async buildDto(id: string): Promise<WorkstreamDto> {
    const workstream = await this.workstreamRepository.findDetails(id);

    return toWorkstreamDto(workstream);
  }

  /** Same-project guard, enforced here rather than as a composite FK (ADR 0006). */
  private async findGroupInProject(
    groupId: string,
    projectId: string,
  ): Promise<Group> {
    const group = await this.groupRepository.findOneInProject(
      groupId,
      projectId,
    );

    if (!group) {
      throw new NotFoundException(
        `Group ${groupId} does not exist in this project`,
      );
    }

    return group;
  }

  private async findUser(userId: string): Promise<User> {
    return this.userRepository.findOne(userId);
  }
}
