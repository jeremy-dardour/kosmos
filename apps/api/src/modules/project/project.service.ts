import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Project } from '@/database/entities/project.entity';
import { ProjectRepository } from '@/modules/project/repositories/project.repository';
import { conflict } from '@/modules/project/utils/conflict.util';

import type { Env } from '@/app/config/env.schema';
import type { User } from '@/database/entities/user.entity';
import type { CreateProjectDto } from '@/modules/project/dtos/input/create-project.dto';
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

  async findAllForActor(actor: User): Promise<Project[]> {
    return this.projectRepository.findAllForActor(actor.id);
  }

  async findOne(id: string, actor: User): Promise<Project> {
    return this.projectRepository.findOneForActor(id, actor.id);
  }

  async create(dto: CreateProjectDto, actor: User): Promise<Project> {
    return this.projectRepository.createOwned(actor, (ownedCount) => {
      if (ownedCount >= this.maxOwnedProjects) {
        conflict(
          'project-limit-reached',
          `You cannot own more than ${this.maxOwnedProjects} projects`,
        );
      }

      const project = new Project();
      project.name = dto.name;
      project.eventDate = dto.eventDate ?? null;
      project.owner = actor;

      return project;
    });
  }

  async update(
    id: string,
    dto: UpdateProjectDto,
    actor: User,
  ): Promise<Project> {
    const project = await this.findOne(id, actor);

    if (dto.name !== undefined) {
      project.name = dto.name;
    }
    if (dto.eventDate !== undefined) {
      project.eventDate = dto.eventDate;
    }

    await this.projectRepository.save(project);

    return project;
  }
}
