import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CreateItemDto } from '@/modules/item/dtos/input/create-item.dto';
import { UpdateItemDto } from '@/modules/item/dtos/input/update-item.dto';
import { ItemDto } from '@/modules/item/dtos/output/item.dto';
import { ItemService } from '@/modules/item/item.service';

@ApiTags('Items')
@Controller('items')
export class ItemController {
  constructor(private readonly itemService: ItemService) {}

  @Get()
  @ApiOperation({ summary: 'List all items' })
  @ApiResponse({ status: 200, type: [ItemDto] })
  async findAll(): Promise<ItemDto[]> {
    return this.itemService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an item by ID' })
  @ApiResponse({ status: 200, type: ItemDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ItemDto> {
    return this.itemService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new item' })
  @ApiResponse({ status: 201, type: ItemDto })
  async create(@Body() createItemDto: CreateItemDto): Promise<ItemDto> {
    return this.itemService.create(createItemDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an item' })
  @ApiResponse({ status: 200, type: ItemDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateItemDto: UpdateItemDto,
  ): Promise<ItemDto> {
    return this.itemService.update(id, updateItemDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an item' })
  @ApiResponse({ status: 204 })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.itemService.remove(id);
  }
}
