import type { ClientFunctionDefinition } from '@useago/sdk';

export interface JsonSchema {
  type?: string;
  description?: string;
  enum?: string[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  oneOf?: JsonSchema[];
}

type FunctionParameters = ClientFunctionDefinition['parameters'];

/**
 * The SDK types `parameters` as a single flat property map, but the registry
 * forwards the schema to the backend verbatim — nested object and array schemas
 * reach the model intact. One cast here keeps the call sites honest JSON Schema.
 */
export const asFunctionParameters = (schema: JsonSchema): FunctionParameters =>
  schema as unknown as FunctionParameters;
