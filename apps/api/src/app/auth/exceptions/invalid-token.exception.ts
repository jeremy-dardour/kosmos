import { UnauthorizedException } from '@nestjs/common';

export class InvalidTokenException extends UnauthorizedException {
  constructor(message = 'Invalid token') {
    super(message);
    this.name = 'InvalidTokenException';
  }
}
