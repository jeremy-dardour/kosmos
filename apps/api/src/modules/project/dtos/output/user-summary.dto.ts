import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { User } from '@/database/entities/user.entity';

/** Minimal user shape for owner/author references embedded in other responses. */
export class UserSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl?: string | null;
}

export function toUserSummaryDto(user: User): UserSummaryDto {
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
  };
}
