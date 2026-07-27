import { ValidateIf } from 'class-validator';

/**
 * Marks a field as omittable but not nullable.
 *
 * `@IsOptional()` also skips validation for `null`, letting an explicit `null`
 * through to a non-nullable column (500 rather than 422); this skips only
 * `undefined`. Fields where `null` means "clear this" keep `@IsOptional()`.
 */
export function IsOptionalNotNull(): PropertyDecorator {
  return ValidateIf((_object, value) => value !== undefined);
}
