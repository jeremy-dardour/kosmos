import { QueryOrder } from '@mikro-orm/postgresql';

import type { SortOption } from '@/shared/types/sort-option';

export const sortOptionToQueryOrderMapper: Record<SortOption, QueryOrder> = {
  ASC: QueryOrder.ASC,
  DESC: QueryOrder.DESC,
};
