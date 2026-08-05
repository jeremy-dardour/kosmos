import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@/app/auth/decorators';
import {
  ApiCommonErrorResponses,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@/app/decorators/api-problem-responses.decorator';
import { AddMemberDto } from '@/modules/project/dtos/input/add-member.dto';
import {
  MemberDto,
  toMemberDto,
} from '@/modules/project/dtos/output/member.dto';
import { MemberService } from '@/modules/project/member.service';

import type { User } from '@/database/entities/user.entity';

@Controller('projects/:projectId/members')
@ApiTags('members')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@ApiUnauthorizedResponse()
@ApiNotFoundResponse()
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Get()
  @ApiOperation({
    summary: "List a project's members",
    description: 'Any member. Includes pending memberships (no user yet).',
  })
  @ApiOkResponse({ type: [MemberDto] })
  async findAll(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() currentUser: User,
  ): Promise<MemberDto[]> {
    const { ownerId, members } = await this.memberService.findAll(
      projectId,
      currentUser,
    );

    return members.map((member) => toMemberDto(member, ownerId));
  }

  @Post()
  @ApiOperation({
    summary: 'Add a member by email',
    description:
      'Owner only. Joined immediately if the account exists; pending until first sign-in otherwise.',
  })
  @ApiCreatedResponse({ type: MemberDto })
  @ApiForbiddenResponse('Only the project owner can manage members')
  @ApiConflictResponse(
    'The email is already a member, or the member limit is reached',
  )
  async add(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() currentUser: User,
  ): Promise<MemberDto> {
    const member = await this.memberService.add(projectId, dto, currentUser);

    // The add passed the owner check, so the current user's id is the owner id.
    return toMemberDto(member, currentUser.id);
  }

  @Delete(':memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove a member',
    description:
      "The owner removes any member; a member may remove their own row (leave). The owner's row is irremovable.",
  })
  @ApiNoContentResponse()
  @ApiForbiddenResponse('Only the project owner can remove other members')
  @ApiConflictResponse("The owner's membership cannot be removed")
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentUser() currentUser: User,
  ): Promise<void> {
    await this.memberService.remove(projectId, memberId, currentUser);
  }
}
