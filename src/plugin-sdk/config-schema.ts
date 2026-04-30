/** Root OpenCLI configuration Zod schema — the full `opencli.json` shape. */
export { OpenCLISchema } from "../config/zod-schema.js";
export { validateJsonSchemaValue } from "../plugins/schema-validator.js";
export type { JsonSchemaObject } from "../shared/json-schema.types.js";
