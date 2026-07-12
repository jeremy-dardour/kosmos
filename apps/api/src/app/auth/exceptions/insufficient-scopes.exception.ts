import { ForbiddenException } from '@nestjs/common';

export class InsufficientScopesException extends ForbiddenException {
  constructor(requiredScopes: string[], providedScopes: string[] = []) {
    super(
      `Insufficient scopes. Required: [${requiredScopes.join(', ')}], Provided: [${providedScopes.join(', ')}]`,
    );
    this.name = 'InsufficientScopesException';
  }
}
