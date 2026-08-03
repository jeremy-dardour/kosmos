import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class ReorderStepsDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: "Every one of the workstream's future steps, in the new order",
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  ids!: string[];
}
