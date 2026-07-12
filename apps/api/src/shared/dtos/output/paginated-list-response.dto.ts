import { ApiProperty } from '@nestjs/swagger';

/**
 * Offset pagination response base class
 *
 * Spec references:
 * - Google AIP-158 + Stripe API hybrid style
 * - Flat structure, computed fields removed
 */
export class PaginatedListResponseDto<T> {
  constructor({
    data,
    page,
    pageSize,
    total,
    totalPages,
  }: {
    data: T[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }) {
    this.data = data;
    this.page = page;
    this.page_size = pageSize;
    this.total = total;
    this.total_pages = totalPages;
  }

  @ApiProperty({
    description: 'Data array',
    isArray: true,
    required: true,
    nullable: false,
  })
  data!: T[];

  @ApiProperty({
    description: 'Current page number',
    minimum: 1,
    example: 1,
    required: true,
    nullable: false,
  })
  page!: number;

  @ApiProperty({
    description: 'Items per page',
    example: 20,
    required: true,
    nullable: false,
  })
  page_size!: number;

  @ApiProperty({
    description: 'Total items',
    example: 100,
    required: true,
    nullable: false,
  })
  total!: number;

  @ApiProperty({
    description: 'Total pages available',
    example: 5,
    required: true,
    nullable: false,
  })
  total_pages!: number;
}
