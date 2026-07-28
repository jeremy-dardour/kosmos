import { Controller, Get, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuthUserProvisionerService } from '@/app/auth/auth-user-provisioner.service';
import { CurrentUserDto } from '@/modules/user/dtos/output/current-user.dto';

import type { AuthenticatedRequest } from '@/app/auth/types/token.types';

@Controller('users')
@ApiTags('Users')
@ApiBearerAuth()
export class UserController {
  constructor(
    private readonly authUserProvisioner: AuthUserProvisionerService,
  ) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get the current authenticated user',
    description:
      'Returns the server-trusted current user for the provided bearer token.',
  })
  @ApiOkResponse({ type: CurrentUserDto })
  @ApiResponse({
    status: 401,
    description: 'Authentication is required or the bearer token is invalid.',
  })
  @ApiResponse({
    status: 403,
    description: 'The bearer token is valid but the account is not allowed.',
  })
  async me(@Req() request: AuthenticatedRequest): Promise<CurrentUserDto> {
    const user = await this.authUserProvisioner.provision(request.user);

    return {
      id: user.id!,
      email: user.email,
      name: user.name ?? user.email,
      avatarUrl: user.avatarUrl,
    };
  }
}
