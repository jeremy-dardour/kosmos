import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsDefined, IsUUID, ValidateIf } from 'class-validator';

export class ReorderWorkstreamsDto {
  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'The scope to reorder; null is the ungrouped bucket',
  })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsDefined()
  @IsUUID()
  groupId!: string | null;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Every live workstream in that scope, in the new order',
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  ids!: string[];
}
