export type { paths } from '@workspace/api-contracts';
import type { components } from '@workspace/api-contracts';
// Indexed access, not `components.schemas`: `components` is an interface, so
// qualified-name access silently resolves to `any` instead of the schema map.
export type dtos = components['schemas'];
