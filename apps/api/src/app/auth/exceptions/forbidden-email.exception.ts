import { ForbiddenException } from '@nestjs/common';

export class ForbiddenEmailException extends ForbiddenException {
  constructor() {
    super('Authenticated email is not allowed');
    this.name = 'ForbiddenEmailException';
  }
}
