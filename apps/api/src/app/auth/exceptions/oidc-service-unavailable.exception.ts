import { ServiceUnavailableException } from '@nestjs/common';

export class OidcServiceUnavailableException extends ServiceUnavailableException {
  constructor(message = 'OIDC service is unavailable') {
    super(message);
    this.name = 'OidcServiceUnavailableException';
  }
}
