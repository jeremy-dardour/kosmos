import { HttpStatus } from '@nestjs/common';

import { ProblemDetailsException } from '@/shared/exceptions/problem-details.exception';

export function forbidden(typeSlug: string, detail: string): never {
  throw new ProblemDetailsException(HttpStatus.FORBIDDEN, typeSlug, detail);
}
