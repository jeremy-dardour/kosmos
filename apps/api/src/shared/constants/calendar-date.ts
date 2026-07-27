/**
 * Calendar-day shape (`YYYY-MM-DD`). Pair with `@IsDateString()`, which rejects
 * impossible dates the pattern alone lets through (e.g. `2026-13-45`).
 */
export const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
