import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class TransferOwnerDto {
  /** A member row id of this project — the member must have joined. */
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  memberId!: string;
}
