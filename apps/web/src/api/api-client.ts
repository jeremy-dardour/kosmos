import createClient from 'openapi-react-query';

import type { paths } from '@/types/openapi';
import type createFetchClient from 'openapi-fetch';

type TypedFetchClient = ReturnType<typeof createFetchClient<paths>>;

type ApiClient = ReturnType<typeof createClient<paths>>;

export let $api: ApiClient;

export function setApiClient(fetchClient: TypedFetchClient) {
  // eslint-disable-next-line unicorn/no-top-level-assignment-in-function
  $api = createClient<paths>(fetchClient);
}
