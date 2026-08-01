import { HttpStatus } from '@nestjs/common';

import { ProblemDetailsException } from '@/shared/exceptions/problem-details.exception';

export function conflict(typeSlug: string, detail: string): never {
  throw new ProblemDetailsException(HttpStatus.CONFLICT, typeSlug, detail);
}
