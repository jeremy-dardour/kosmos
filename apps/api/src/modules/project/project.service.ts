import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Project } from '@/database/entities/project.entity';
import { ProjectRepository } from '@/modules/project/repositories/project.repository';
import { conflict } from '@/modules/project/utils/conflict.util';
import { forbidden } from '@/modules/project/utils/forbidden.util';

import type { Env } from '@/app/config/env.schema';
import type { User } from '@/database/entities/user.entity';
import type { CreateProjectDto } from '@/modules/project/dtos/input/create-project.dto';
import type { TransferOwnerDto } from '@/modules/project/dtos/input/transfer-owner.dto';
import type { UpdateProjectDto } from '@/modules/project/dtos/input/update-project.dto';

@Injectable()
export class ProjectService {
  /** Bounds accidents, not usage (PRD decision 10). */
  private readonly maxOwnedProjects: number;

  constructor(
    private readonly projectRepository: ProjectRepository,
    configService: ConfigService<Env, true>,
  ) {
    this.maxOwnedProjects = configService.get('MAX_OWNED_PROJECTS', {
      infer: true,
    });
  }

  async findAllForUser(currentUser: User): Promise<Project[]> {
    return this.projectRepository.findAllForUser(currentUser.id);
  }

  async findOne(id: string, currentUser: User): Promise<Project> {
    return this.projectRepository.findOneForUser(id, currentUser.id);
  }

  async create(dto: CreateProjectDto, currentUser: User): Promise<Project> {
    return this.projectRepository.createOwned(currentUser, (ownedCount) => {
      if (ownedCount >= this.maxOwnedProjects) {
        conflict(
          'project-limit-reached',
          `You cannot own more than ${this.maxOwnedProjects} projects`,
        );
      }

      const project = new Project();
      project.name = dto.name;
      project.eventDate = dto.eventDate ?? null;
      project.owner = currentUser;

      return project;
    });
  }

  async update(
    id: string,
    dto: UpdateProjectDto,
    currentUser: User,
  ): Promise<Project> {
    const project = await this.findOne(id, currentUser);

    if (dto.name !== undefined) {
      project.name = dto.name;
    }
    if (dto.eventDate !== undefined) {
      project.eventDate = dto.eventDate;
    }

    await this.projectRepository.save(project);

    return project;
  }

  async transferOwnership(
    id: string,
    dto: TransferOwnerDto,
    currentUser: User,
  ): Promise<Project> {
    return this.projectRepository.transferOwnership(
      id,
      currentUser.id,
      dto.memberId,
      ({ ownerId, targetMember }) => {
        this.assertOwner(ownerId, currentUser);

        // Pending rows and foreign member ids are indistinguishable here, so
        // neither leaks whether the id exists.
        const targetUser = targetMember?.user;
        if (!targetUser) {
          conflict(
            'transfer-target-not-member',
            'The new owner must be a joined member of this project',
          );
        }

        return targetUser;
      },
    );
  }

  async softDelete(id: string, currentUser: User): Promise<void> {
    await this.projectRepository.softDelete(id, currentUser.id, ({ ownerId }) =>
      this.assertOwner(ownerId, currentUser),
    );
  }

  async restore(id: string, currentUser: User): Promise<Project> {
    return this.projectRepository.restoreOwned(
      id,
      currentUser.id,
      ({ ownerId, isDeleted, liveOwnedCount }) => {
        this.assertOwner(ownerId, currentUser);
        if (!isDeleted) {
          conflict('project-not-deleted', 'The project is not deleted');
        }
        if (liveOwnedCount >= this.maxOwnedProjects) {
          conflict(
            'project-limit-reached',
            `You cannot own more than ${this.maxOwnedProjects} projects`,
          );
        }
      },
    );
  }

  private assertOwner(ownerId: string, currentUser: User): void {
    if (ownerId !== currentUser.id) {
      forbidden(
        'not-project-owner',
        'Only the project owner can perform this operation',
      );
    }
  }
}
