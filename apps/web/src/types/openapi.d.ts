export type { paths } from '@workspace/api-contracts';
import type { components } from '@workspace/api-contracts';
// Must stay indexed access: `components` is an interface, so `components.schemas`
// resolves to `any` instead of the schema map.
export type dtos = components['schemas'];
