import { Injectable } from '@nestjs/common';

import { Project } from '@/database/entities/project.entity';
import { ProjectRepository } from '@/modules/project/repositories/project.repository';

import type { CreateProjectDto } from '@/modules/project/dtos/input/create-project.dto';
import type { UpdateProjectDto } from '@/modules/project/dtos/input/update-project.dto';

@Injectable()
export class ProjectService {
  constructor(private readonly projectRepository: ProjectRepository) {}

  async findAll(): Promise<Project[]> {
    return this.projectRepository.findAll();
  }

  async findOne(id: string): Promise<Project> {
    return this.projectRepository.findOne(id);
  }

  async create(dto: CreateProjectDto): Promise<Project> {
    const project = new Project();
    project.name = dto.name;
    project.eventDate = dto.eventDate ?? null;

    await this.projectRepository.save(project);

    return project;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id);

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
