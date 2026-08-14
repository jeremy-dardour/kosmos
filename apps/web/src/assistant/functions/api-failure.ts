/**
 * A rejected request throws the RFC 9457 Problem Details body itself, so the
 * reportable reason is `detail`; an `ApiError` and a transport failure both
 * fall back to the message.
 */
export function describeFailure(error: unknown): string {
  if (error !== null && typeof error === 'object') {
    const problem = error as { detail?: unknown; title?: unknown };
    if (typeof problem.detail === 'string' && problem.detail.length > 0) {
      return problem.detail;
    }
    if (typeof problem.title === 'string' && problem.title.length > 0) {
      return problem.title;
    }
  }
  if (error instanceof Error && error.message.length > 0) return error.message;

  return 'The request failed for an unknown reason.';
}
