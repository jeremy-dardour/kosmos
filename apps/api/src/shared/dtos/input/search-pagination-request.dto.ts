import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { PageSizeValues } from '@/shared/constants/pagination-page';
import { SortOptionValues } from '@/shared/types/sort-option';

import type { SortOption } from '@/shared/types/sort-option';

export class SearchPaginationRequestDto<T> {
  @ApiProperty({
    description: 'Data array',
    isArray: true,
    required: false,
    nullable: false,
  })
  @IsOptional()
  @IsArray()
  @Transform(({ value }: { value: T | T[] }) =>
    Array.isArray(value) ? value : [value],
  )
  search_fields?: T[];

  @ApiProperty({
    description: 'Query value',
    example: 'Jane',
    required: false,
    nullable: false,
  })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiProperty({
    description: 'The field to sort by',
    example: 'Name',
    required: false,
    nullable: false,
  })
  @IsOptional()
  sort_by?: T;

  @ApiProperty({
    description: 'Sort order',
    enum: SortOptionValues,
    default: 'ASC',
    required: false,
    nullable: false,
  })
  @IsOptional()
  @IsEnum(SortOptionValues)
  sort_order: SortOption = 'ASC';

  @ApiProperty({
    description: 'Page to query',
    minimum: 1,
    default: 1,
    example: 3,
    required: false,
    nullable: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiProperty({
    description: 'Page size',
    enum: PageSizeValues,
    default: 10,
    example: 10,
    required: false,
    nullable: false,
  })
  @IsOptional()
  @IsNumber()
  @IsIn(PageSizeValues)
  page_size?: number;
}
