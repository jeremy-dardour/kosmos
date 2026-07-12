export const SortOptionValues = ['ASC', 'DESC'] as const;

export type SortOption = (typeof SortOptionValues)[number];
