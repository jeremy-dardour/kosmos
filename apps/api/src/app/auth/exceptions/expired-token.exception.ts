import { UnauthorizedException } from '@nestjs/common';

export class ExpiredTokenException extends UnauthorizedException {
  constructor(message = 'Token has expired') {
    super(message);
    this.name = 'ExpiredTokenException';
  }
}
