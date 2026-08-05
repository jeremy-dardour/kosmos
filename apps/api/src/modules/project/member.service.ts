import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MemberRepository } from '@/modules/project/repositories/member.repository';
import { conflict } from '@/modules/project/utils/conflict.util';
import { forbidden } from '@/modules/project/utils/forbidden.util';

import type { Env } from '@/app/config/env.schema';
import type { ProjectMember } from '@/database/entities/project-member.entity';
import type { User } from '@/database/entities/user.entity';
import type { AddMemberDto } from '@/modules/project/dtos/input/add-member.dto';

@Injectable()
export class MemberService {
  /** Bounds accidents, not usage (PRD decision 10). Counts joined + pending. */
  private readonly maxProjectMembers: number;

  constructor(
    private readonly memberRepository: MemberRepository,
    configService: ConfigService<Env, true>,
  ) {
    this.maxProjectMembers = configService.get('MAX_PROJECT_MEMBERS', {
      infer: true,
    });
  }

  async findAll(
    projectId: string,
    currentUser: User,
  ): Promise<{ ownerId: string; members: ProjectMember[] }> {
    return this.memberRepository.findProjectMembers(projectId, currentUser.id);
  }

  async add(
    projectId: string,
    dto: AddMemberDto,
    currentUser: User,
  ): Promise<ProjectMember> {
    const email = dto.email.toLowerCase();

    return this.memberRepository.addMember(
      projectId,
      currentUser.id,
      email,
      ({ ownerId, existing, memberCount }) => {
        if (ownerId !== currentUser.id) {
          forbidden(
            'not-project-owner',
            'Only the project owner can manage members',
          );
        }
        // Duplicate wins over the cap: re-adding a present email reports
        // duplicate-member even at capacity.
        if (existing) {
          conflict(
            'duplicate-member',
            'This email is already a member of the project',
          );
        }
        if (memberCount >= this.maxProjectMembers) {
          conflict(
            'member-limit-reached',
            `A project cannot have more than ${this.maxProjectMembers} members`,
          );
        }
      },
    );
  }

  async remove(
    projectId: string,
    memberId: string,
    currentUser: User,
  ): Promise<void> {
    await this.memberRepository.removeMember(
      projectId,
      currentUser.id,
      memberId,
      ({ ownerId, member }) => {
        // Checked before any permission branch: the owner's row is
        // irremovable for everyone, including the owner leaving.
        if (member.user?.id === ownerId) {
          conflict(
            'cannot-remove-owner',
            'The owner cannot be removed — transfer ownership or delete the project instead',
          );
        }
        const isOwnRow = member.user?.id === currentUser.id;
        if (currentUser.id !== ownerId && !isOwnRow) {
          forbidden(
            'not-project-owner',
            'Only the project owner can remove other members',
          );
        }
      },
    );
  }
}
