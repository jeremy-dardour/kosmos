import createClient from 'openapi-react-query';

import type { paths } from '@/types/openapi';
import type createFetchClient from 'openapi-fetch';

type TypedFetchClient = ReturnType<typeof createFetchClient<paths>>;

type ApiClient = ReturnType<typeof createClient<paths>>;

export let $api: ApiClient;

/** The typed client itself, for requests issued outside React. */
export let $fetch: TypedFetchClient;

export function setApiClient(fetchClient: TypedFetchClient) {
  // eslint-disable-next-line unicorn/no-top-level-assignment-in-function
  $fetch = fetchClient;
  // eslint-disable-next-line unicorn/no-top-level-assignment-in-function
  $api = createClient<paths>(fetchClient);
}

type ApiData<TResult> = TResult extends { data?: infer TData }
  ? Exclude<TData, undefined>
  : never;

/**
 * A rejected request carries the Problem Details body itself, not an `Error` —
 * what `$api`'s own query and mutation functions throw, and what
 * `formatToApiError` normalizes. Throwing the error verbatim is what makes
 * `$fetch` callers fail the same way as the hooks.
 */
export function unwrapApiResult<
  TResult extends { data?: unknown; error?: unknown },
>(result: TResult): ApiData<TResult> {
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  if (result.error) throw result.error;

  return (result as { data: ApiData<TResult> }).data;
}
