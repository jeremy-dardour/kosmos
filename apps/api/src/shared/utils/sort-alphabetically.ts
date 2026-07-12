export function sortAlphabeticallyByField<T>(array: T[], field: keyof T): T[] {
  return array.sort((a, b) => {
    const fieldA = a[field] as unknown as string;
    const fieldB = b[field] as unknown as string;
    return fieldA.localeCompare(fieldB);
  });
}
