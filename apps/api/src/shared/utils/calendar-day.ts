export const MILLISECONDS_PER_DAY = 86_400_000;

export function calendarDay(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${dayOfMonth}`;
}

export function instantAt(offsetDays: number): Date {
  return new Date(Date.now() + offsetDays * MILLISECONDS_PER_DAY);
}
