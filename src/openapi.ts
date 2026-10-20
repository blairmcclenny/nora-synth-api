import { createRoute, OpenAPIHono, z, type RouteConfig } from '@hono/zod-openapi';
import {
  createPresetInputSchema,
  presetIdSchema,
  presetListInputSchema,
  presetPageSchema,
  presetSchema,
  renamePresetInputSchema,
} from './schemas/preset.js';
import { requireJson } from './middleware/require-json.js';

const errorSchema = z
  .strictObject({
    error: z.strictObject({
      code: z.enum([
        'VALIDATION_ERROR',
        'INVALID_JSON',
        'UNAUTHORIZED',
        'NOT_FOUND',
        'UNSUPPORTED_MEDIA_TYPE',
        'INTERNAL_ERROR',
      ]),
      message: z.string(),
      details: z.array(z.strictObject({ path: z.string(), message: z.string() })).optional(),
    }),
  })
  .openapi('Error');

const json = <T extends z.ZodType>(schema: T) => ({ 'application/json': { schema } });
const error = (description: string) => ({ description, content: json(errorSchema) });
const authErrors = {
  401: error(
    'Missing, malformed, or incorrect Bearer credentials. Authentication precedes validation and persistence.',
  ),
  500: error('Unexpected server error. Returns INTERNAL_ERROR without internal details.'),
};
const idErrors = {
  ...authErrors,
  400: error('Invalid UUID. Returns VALIDATION_ERROR: Preset ID must be a valid UUID.'),
  404: error('Preset does not exist or belongs to another owner. Returns NOT_FOUND.'),
};
const bodyErrors = {
  ...authErrors,
  400: error(
    'Invalid body returns VALIDATION_ERROR with field paths and messages in details. Malformed JSON returns INVALID_JSON. For PATCH and PUT, invalid UUID also returns VALIDATION_ERROR. Authentication and Content-Type are checked first, then UUID, then body.',
  ),
  415: error(
    'Content-Type must be application/json. Charset parameters are accepted. Returns UNSUPPORTED_MEDIA_TYPE.',
  ),
};
const missing = { 404: idErrors[404] };
const body = <T extends z.ZodType>(schema: T) => ({ required: true, content: json(schema) });

export const routes = {
  health: createRoute({
    method: 'get',
    path: '/health',
    operationId: 'getHealth',
    summary: 'Report service liveness',
    description: 'Does not query the database.',
    security: [],
    responses: {
      200: {
        description: 'Service is running.',
        content: json(
          z
            .strictObject({ service: z.literal('nora-synth-api'), status: z.literal('ok') })
            .openapi('Health'),
        ),
      },
    },
  }),
  list: createRoute({
    method: 'get',
    path: '/v1/presets',
    operationId: 'listPresets',
    summary: 'List the authenticated owner’s presets',
    description:
      'Ordered by updated_at descending, then UUID ascending. Total counts this owner’s records independently of pagination. Unknown query parameters are rejected. Empty pages have items: [].',
    request: { query: presetListInputSchema },
    responses: {
      200: { description: 'A page of presets.', content: json(presetPageSchema) },
      400: error(
        'Invalid pagination or unknown query parameter. Returns VALIDATION_ERROR with field paths and messages in details.',
      ),
      ...authErrors,
    },
  }),
  get: createRoute({
    method: 'get',
    path: '/v1/presets/{id}',
    operationId: 'getPreset',
    summary: 'Retrieve an owned preset',
    request: { params: presetIdSchema },
    responses: { 200: { description: 'Full preset.', content: json(presetSchema) }, ...idErrors },
  }),
  create: createRoute({
    method: 'post',
    path: '/v1/presets',
    operationId: 'createPreset',
    summary: 'Save a complete preset',
    description:
      'All nine normalized controls are required. Names are trimmed before length validation. Unknown fields, including ownerId, are rejected. Duplicate names are allowed.',
    middleware: [requireJson] as const,
    request: { body: body(createPresetInputSchema) },
    responses: {
      201: {
        description: 'Preset created with a server-generated UUID and timestamps.',
        content: json(presetSchema),
        headers: {
          Location: {
            description: 'Relative URL of the created preset.',
            required: true,
            schema: { type: 'string' },
            example: '/v1/presets/123e4567-e89b-42d3-a456-426614174000',
          },
        },
      },
      ...bodyErrors,
    },
  }),
  rename: createRoute({
    method: 'patch',
    path: '/v1/presets/{id}',
    operationId: 'renamePreset',
    summary: 'Rename an owned preset',
    description:
      'Trims and updates name and updatedAt while preserving all other fields. Unknown fields are rejected. Does not create missing presets.',
    middleware: [requireJson] as const,
    request: { params: presetIdSchema, body: body(renamePresetInputSchema) },
    responses: {
      200: { description: 'Renamed preset.', content: json(presetSchema) },
      ...bodyErrors,
      ...missing,
    },
  }),
  replace: createRoute({
    method: 'put',
    path: '/v1/presets/{id}',
    operationId: 'replacePreset',
    summary: 'Replace a complete owned preset',
    description:
      'Replaces name, schemaVersion, and all nine parameters; updates updatedAt. Trims names and rejects unknown fields. Preserves id and createdAt. Does not create missing presets.',
    middleware: [requireJson] as const,
    request: { params: presetIdSchema, body: body(createPresetInputSchema) },
    responses: {
      200: { description: 'Replaced preset.', content: json(presetSchema) },
      ...bodyErrors,
      ...missing,
    },
  }),
  delete: createRoute({
    method: 'delete',
    path: '/v1/presets/{id}',
    operationId: 'deletePreset',
    summary: 'Delete an owned preset',
    description: 'Subsequent recall or deletion returns 404.',
    request: { params: presetIdSchema },
    responses: { 204: { description: 'Deleted successfully; no response body.' }, ...idErrors },
  }),
};

export const openapiConfig = {
  openapi: '3.1.0',
  info: {
    title: 'Nora Synth API',
    version: '0.1.0',
    description:
      'Standalone preset API. All preset operations are scoped to the authenticated owner. The opaque Bearer secret maps to a configured stable AUTH_OWNER_ID; rotate AUTH_SECRET while preserving AUTH_OWNER_ID to retain access. Ownership is never accepted from callers or exposed in responses. The current server supports one configured identity at a time.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local development' }],
  security: [{ BearerAuth: [] }],
};

export function generateOpenAPIDocument() {
  const app = new OpenAPIHono();
  app.openAPIRegistry.registerComponent('securitySchemes', 'BearerAuth', {
    type: 'http',
    scheme: 'bearer',
    description: 'Configured AUTH_SECRET: Authorization: Bearer <secret>.',
  });
  for (const route of Object.values(routes)) {
    const { middleware: _middleware, ...definition }: RouteConfig = route;
    app.openAPIRegistry.registerPath(definition);
  }
  return app.getOpenAPI31Document(openapiConfig);
}
