import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

@Controller('.well-known')
@ApiExcludeController()
export class SwaggerDevController {
  @Get('swagger-credentials')
  getCredentials() {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }

    return {
      info: 'Set FAKE_AUTH=true to bypass authentication in development',
    };
  }
}
