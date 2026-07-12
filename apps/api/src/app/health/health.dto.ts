/**
 * Health indicator result from @nestjs/terminus
 */
export interface HealthIndicatorResult {
  status: 'up' | 'down';
  message?: string;
}

/**
 * Health check response structure
 */
export type HealthResponse = Record<string, HealthIndicatorResult>;
