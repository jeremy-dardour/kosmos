import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class ReorderGroupsDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: "Every one of the project's groups, in the new order",
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  ids!: string[];
}
