import { HttpException } from '@nestjs/common';

/**
 * An HTTP exception with a stable RFC 9457 problem type.
 * The global filter turns `typeSlug` into the configured absolute error URI.
 */
export class ProblemDetailsException extends HttpException {
  constructor(
    status: number,
    readonly typeSlug: string,
    detail: string,
  ) {
    super(detail, status);
  }
}
