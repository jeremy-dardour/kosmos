import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { ProjectMember } from '@/database/entities/project-member.entity';

export class MemberDto {
  /** Member row id — not the user id. */
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Null while the membership is pending its first sign-in',
  })
  userId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  name?: string | null;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl?: string | null;

  @ApiProperty()
  isOwner!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export function toMemberDto(member: ProjectMember, ownerId: string): MemberDto {
  return {
    id: member.id,
    email: member.email,
    userId: member.user?.id ?? null,
    name: member.user?.name ?? null,
    avatarUrl: member.user?.avatarUrl ?? null,
    isOwner: member.user?.id === ownerId,
    createdAt: member.createdAt,
  };
}
