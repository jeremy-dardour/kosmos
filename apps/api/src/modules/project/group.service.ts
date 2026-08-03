import { Injectable } from '@nestjs/common';

import { Group } from '@/database/entities/group.entity';
import { GroupRepository } from '@/modules/project/repositories/group.repository';
import { ProjectRepository } from '@/modules/project/repositories/project.repository';
import { conflict } from '@/modules/project/utils/conflict.util';
import { isExactMembership } from '@/modules/project/utils/order-membership.util';

import type { CreateGroupDto } from '@/modules/project/dtos/input/create-group.dto';
import type { ReorderGroupsDto } from '@/modules/project/dtos/input/reorder-groups.dto';
import type { UpdateGroupDto } from '@/modules/project/dtos/input/update-group.dto';

@Injectable()
export class GroupService {
  constructor(
    private readonly groupRepository: GroupRepository,
    private readonly projectRepository: ProjectRepository,
  ) {}

  async findAllByProject(projectId: string): Promise<Group[]> {
    const project = await this.projectRepository.findOneOrFail(projectId);

    return this.groupRepository.findAllByProject(project);
  }

  async create(projectId: string, dto: CreateGroupDto): Promise<Group> {
    const project = await this.projectRepository.findOneOrFail(projectId);

    const group = new Group();
    group.project = project;
    group.name = dto.name;
    group.color = dto.color;

    await this.groupRepository.insertAtEnd(group);

    return group;
  }

  async update(id: string, dto: UpdateGroupDto): Promise<Group> {
    const group = await this.groupRepository.findOneOrFail(id);

    if (dto.name !== undefined) {
      group.name = dto.name;
    }
    if (dto.color !== undefined) {
      group.color = dto.color;
    }

    await this.groupRepository.save(group);

    return group;
  }

  async reorder(projectId: string, dto: ReorderGroupsDto): Promise<Group[]> {
    return this.groupRepository.reorder(projectId, (groups) => {
      const byId = new Map(groups.map((group) => [group.id, group]));
      const memberIds = groups.map((group) => group.id);

      if (!isExactMembership(dto.ids, memberIds)) {
        conflict(
          'order-mismatch',
          "The submitted ids do not match the project's groups",
        );
      }

      return dto.ids.map((id) => byId.get(id)!);
    });
  }

  /** Ungroups the group's workstreams — the FK is ON DELETE SET NULL. */
  async remove(id: string): Promise<void> {
    await this.groupRepository.remove(
      await this.groupRepository.findOneOrFail(id),
    );
  }
}
