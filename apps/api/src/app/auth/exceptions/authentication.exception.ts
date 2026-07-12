import { UnauthorizedException } from '@nestjs/common';

export class AuthenticationException extends UnauthorizedException {
  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationException';
  }
}
