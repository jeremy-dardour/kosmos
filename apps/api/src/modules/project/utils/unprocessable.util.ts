import { HttpStatus } from '@nestjs/common';

import { ProblemDetailsException } from '@/shared/exceptions/problem-details.exception';

/** Raises an RFC 9457 422 with a stable machine-readable type slug. */
export function unprocessable(typeSlug: string, detail: string): never {
  throw new ProblemDetailsException(
    HttpStatus.UNPROCESSABLE_ENTITY,
    typeSlug,
    detail,
  );
}
