interface ValidationError {
  field: string;
  pointer: string;
  code: string;
  message: string;
}

// RFC 7807 error response (frontend fields only)
interface ProblemDetails {
  detail?: string;
  errors?: ValidationError[];
  request_id?: string;
  correlation_id?: string;
}

export class ApiError extends Error {
  public detail?: string;
  public errors?: ValidationError[];
  public requestId?: string;

  constructor(
    message: string,
    public status: number,
    public statusText: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';

    // Extract RFC 7807 fields
    const problem = data as ProblemDetails;
    this.detail = problem?.detail;
    this.errors = problem?.errors;
    this.requestId = problem?.request_id ?? problem?.correlation_id;
  }
}
