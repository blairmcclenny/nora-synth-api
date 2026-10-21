# Nora Synth API

Status: private MVP implemented and verified locally; deployment pending · Updated October 21, 2026

## Goal

Build a standalone backend API using Hono that lets a synth save and recall presets. A preset is a named snapshot of all nine synth parameters. The synth client handles audio generation and applies the saved values; the API validates and persists them.

The main learning goal is to complete this standalone API. Frontend construction
and synth integration are deferred until the API lessons are finished.

## Confirmed requirements

- Hono backend, independently deployable from the synth interface.
- PostgreSQL for preset persistence.
- Saving presets is the primary feature.
- Parameters: filter, mood, movement, space, expression, attack, decay, sustain, release.

## Current stack and MVP decisions

| Layer | Implementation |
| --- | --- |
| Runtime | Node.js 24+, TypeScript, ES modules, npm; tsx for local development |
| HTTP | Hono with the Node server adapter and OpenAPIHono from `@hono/zod-openapi` |
| Validation and contracts | Shared Zod request/response schemas, inferred TypeScript types, generated OpenAPI 3.1 |
| Persistence | PostgreSQL 18 locally in Docker Desktop, Drizzle ORM queries over a `pg` connection pool |
| Migrations | Numbered SQL files and a custom transactional migration runner; Drizzle Kit is not configured |
| Verification | Node's test runner, HTTP and database tests, Swagger Parser, Ajv, TypeScript checks |

- JSON REST API under `/v1`, with public operational probes outside that prefix.
- A private MVP with one configured Bearer secret mapped to a stable owner
  identity. Every preset operation is scoped to that owner. Multiple real user
  accounts and password storage remain future work.
- Every parameter is a normalized number from `0` to `1`, inclusive. These are
  the implemented API and database constraints. The synth's engine mappings
  remain to be defined; attack, decay, and release are normalized controls.
- No implicit parameter defaults when saving: the client supplies a complete snapshot.
- CRUD, authentication, ownership, generated API documentation, startup validation,
  readiness, graceful shutdown, and restart persistence are implemented and merged.
- Hosting, managed PostgreSQL, HTTPS, production secrets, backups, and hosted
  verification remain pending. Frontend construction remains deferred.

## Parameter contract

| Parameter | Type / range | Intended role, pending synth design |
| --- | --- | --- |
| `filter` | number, 0–1 | Filter control; exact mapping to be defined |
| `mood` | number, 0–1 | Tonal character macro |
| `movement` | number, 0–1 | Modulation or motion macro |
| `space` | number, 0–1 | Spatial effects macro |
| `expression` | number, 0–1 | Expressive response macro |
| `attack` | number, 0–1 | Envelope attack control |
| `decay` | number, 0–1 | Envelope decay control |
| `sustain` | number, 0–1 | Envelope sustain level |
| `release` | number, 0–1 | Envelope release control |

The API stores values without interpreting their sound. Before implementing the client integration, document each control's mapping and endpoints. Preserve those meanings within a parameter schema version; introduce a new version if they change incompatibly.

## Preset model

```json
{
  "id": "5d02b735-1d40-4c88-84c1-252b1f9c8c43",
  "name": "Soft Motion",
  "schemaVersion": 1,
  "parameters": {
    "filter": 0.45,
    "mood": 0.65,
    "movement": 0.3,
    "space": 0.55,
    "expression": 0.7,
    "attack": 0.2,
    "decay": 0.35,
    "sustain": 0.8,
    "release": 0.5
  },
  "createdAt": "2026-09-14T12:00:00.000Z",
  "updatedAt": "2026-09-14T12:00:00.000Z"
}
```

- Server generates UUID identifiers and UTC timestamps.
- Names are trimmed, nonempty, and limited to 100 characters. Duplicate names are allowed; IDs identify presets.
- `schemaVersion` describes the parameter contract, independently of the `/v1` API version. Only `1` is currently accepted.
- Reject unknown fields, missing parameters, numeric strings, nulls, and out-of-range values. Do not silently clamp or coerce values.
- Creation and replacement requests contain only `name`, `schemaVersion`, and `parameters`.

## API contract

| Method | Route | Behavior | Success |
| --- | --- | --- | --- |
| POST | `/v1/presets` | Save a new complete preset | 201, full preset |
| GET | `/v1/presets` | List saved presets | 200, list envelope |
| GET | `/v1/presets/:id` | Recall one preset | 200, full preset |
| PATCH | `/v1/presets/:id` | Rename a preset | 200, full preset |
| PUT | `/v1/presets/:id` | Replace name and complete parameter snapshot | 200, full preset |
| DELETE | `/v1/presets/:id` | Delete one preset | 204, no body |
| GET | `/health` | Report service liveness without querying PostgreSQL | 200, `{"service":"nora-synth-api","status":"ok"}` |
| GET | `/ready` | Check database connectivity with `SELECT 1` | 200, `{"service":"nora-synth-api","status":"ready"}`, or 503 |

All preset endpoints require valid Bearer credentials; `/health` and `/ready` are public. The
server maps `AUTH_SECRET` to `AUTH_OWNER_ID` and derives ownership from that trusted
identity. Keep the owner ID stable when rotating the secret. Listing and totals
include only that owner's presets; inaccessible IDs return 404.

POST returns a `Location` header pointing to the created resource. PUT preserves `id` and `createdAt`, and advances `updatedAt`; it does not create missing resources. Updates use last successful write wins. PATCH changes only the name and update timestamp, preserving the ID, creation timestamp, schema version, and all parameters.

List query parameters: `limit` (default 50, range 1–100) and `offset` (default 0, nonnegative integer). Return `{"items": [...], "limit": 50, "offset": 0, "total": 1}` with full preset objects, ordered by `updatedAt` descending and then `id` ascending.

### Save request

`POST /v1/presets` with `Content-Type: application/json`:

```json
{
  "name": "Soft Motion",
  "schemaVersion": 1,
  "parameters": {
    "filter": 0.45,
    "mood": 0.65,
    "movement": 0.3,
    "space": 0.55,
    "expression": 0.7,
    "attack": 0.2,
    "decay": 0.35,
    "sustain": 0.8,
    "release": 0.5
  }
}
```

### Errors

Responses use a consistent JSON error envelope (validation messages below are illustrative):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Preset contains invalid values.",
    "details": [
      { "path": "parameters.filter", "message": "Must be a number between 0 and 1." }
    ]
  }
}
```

Return 400 for malformed JSON, invalid IDs, invalid query parameters, or invalid preset data; 401 for missing or invalid credentials; 404 for missing or inaccessible resources; 415 for unsupported request content types; 500 for unexpected server errors; and 503 with `NOT_READY` when the readiness probe cannot reach the database. Omit internal error details from responses. Failed validation must never change stored data.

## Backend structure

```text
src/
  app.ts                  OpenAPIHono route handlers and shared error handling
  openapi.ts              Route contracts and OpenAPI generation
  config.ts               Startup environment validation
  server.ts               HTTP listener and signal registration
  shutdown.ts             Request draining, pool cleanup, and shutdown deadline
  middleware/             Bearer authentication and JSON content-type checks
  schemas/preset.ts       Shared Zod request and response schemas
  types/preset.ts         Inferred inputs and public preset types
  repositories/presets.ts Typed Drizzle queries and database-to-JSON mapping
  db/
    pool.ts               PostgreSQL pool and timeouts
    client.ts             Drizzle client over the pool
    schema.ts             Drizzle table, constraints, and index definitions
    migrations/           Numbered SQL migrations
    migrate.ts            Migration command
    migration-runner.ts   Tracking, locking, adoption, and transactions
```

Shared Zod schemas supply request validation, inferred input types, and the
OpenAPI contract. Route definitions in `src/openapi.ts` are used by OpenAPIHono
and generate [openapi.json](openapi.json). Run `npm run openapi:generate` after
contract changes; `npm run openapi:validate` validates structure and checks that
the committed artifact matches its sources.

Authentication precedes validation and persistence. JSON content-type checks
precede body parsing; PATCH and PUT validate the UUID before the body. Ownership
comes only from the authenticated request context. Caller-supplied ownership
fields are rejected and owner IDs are omitted from public preset responses.

Persist each preset in PostgreSQL in a `presets` table with these columns:

| Columns | PostgreSQL type | Constraints |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `owner_id` | text | NOT NULL; nonempty with no surrounding spaces |
| `name` | text | NOT NULL |
| `schema_version` | integer | NOT NULL; must equal 1 |
| `filter`, `mood`, `movement`, `space`, `expression` | double precision, one column per parameter | NOT NULL; each value between 0 and 1 |
| `attack`, `decay`, `sustain`, `release` | double precision, one column per parameter | NOT NULL; each value between 0 and 1 |
| `created_at`, `updated_at` | timestamp with time zone | NOT NULL |

Use a separate numeric column for each of the nine parameters, with a database CHECK constraint enforcing its range in addition to API validation. The current schema enforces 0–1; incompatible changes require an explicit versioning and migration decision.

The API continues to group these values inside the `parameters` object in JSON requests and responses. The repository maps that object to and from the individual database columns.

Store the complete parameter snapshot atomically. Keep PostgreSQL migrations in source control. A successful save response must follow a committed database write.

The implemented database connection uses `pg` pooling and `DATABASE_URL`. Tracked
migrations include explicit owner assignment for legacy presets using
`AUTH_OWNER_ID`. New records require a server-supplied owner; there is no database
owner default.

The owner/update/ID index supports owner-scoped listing. The migration runner
records applied filenames in `schema_migrations`, skips applied files, and uses
an advisory lock to serialize runners. Each migration and its tracking entry
commit atomically or roll back together. Explicit initial-schema adoption checks
compatibility while preserving existing records. Applied SQL files stay unchanged;
new changes require new numbered files. Migrations run explicitly, not at startup.

## Runtime and local operation

Local PostgreSQL uses the existing `nora-postgres` Docker container. Development
uses `nora_synth`; database tests require the separate `nora_synth_test` database
and clean up only disposable fixtures. Both local databases are migrated. Follow
the [README setup workflow](../README.md#local-setup) and preserve ignored `.env`
credentials.

| Setting | Startup requirement or default |
| --- | --- |
| `DATABASE_URL` | Required PostgreSQL URL with a host and database name |
| `AUTH_SECRET` | Required, nonempty, no whitespace |
| `AUTH_OWNER_ID` | Required stable owner ID, nonempty, no surrounding whitespace |
| `HOST` | Defaults to `127.0.0.1`; hostname or IPv4 address |
| `PORT` | Defaults to `3000`; integer from 1 to 65535 |
| `TEST_DATABASE_URL` | Required by database tests; must target `nora_synth_test` |

Invalid runtime configuration stops startup before listening. `npm run dev`
loads `.env`; `npm start` runs the compiled server with configuration supplied
through the environment. `npm run build` compiles TypeScript and copies SQL
migrations into `dist/db/migrations`.

`/health` reports process liveness even during database outages. `/ready` checks
connectivity, without checking migration state, and returns a generic 503 on
failure. Later probes can recover. Pool connection acquisition, client queries,
and server statements each have a 3-second timeout; connection acquisition and
query execution can consume separate intervals.

SIGINT and SIGTERM stop new connections, drain active HTTP requests, close the
pool, and exit 0 after successful cleanup. Repeated signals share one sequence.
Listener or pool cleanup failures exit 1. A 10-second deadline covers draining
and pool cleanup; expiry closes remaining HTTP connections and exits 1.

## Verification state

The latest completed implementation passed 118 unit/HTTP tests, 21 database
tests, typecheck, build, and OpenAPI validation. Coverage includes validation
boundaries, HTTP rejections and safe errors, CRUD persistence, owner isolation,
secret rotation, migration adoption and rollback, readiness failure/recovery,
request draining, repeated shutdown, pool failure, and shutdown deadlines.

The restart test launches the actual API process, saves a preset over HTTP,
sends SIGTERM, restarts on the same port, and compares the full recalled preset.
It also verifies a clean SIGINT exit. PostgreSQL remains running during this
check; hosted deployment and database recovery have not yet been verified.

Regression commands:

```sh
npm test
npm run test:db
npm run typecheck
npm run build
npm run openapi:validate
```

## Planned synth client flow

1. The user adjusts the synth and enters a preset name.
2. The client sends all nine current values to POST.
3. The API validates, commits, and returns the stored preset.
4. The client displays confirmation only after success and retains current settings if saving fails.
5. On recall, the client fetches the preset and applies all nine values together.
6. Saving changes to an existing preset uses PUT; “Save as new” uses POST.

## Implemented acceptance criteria

- Save and retrieve a preset with all nine values unchanged.
- Restart the service and retrieve previously saved presets.
- List presets and rename, replace, and delete presets by ID.
- Accept boundary values 0 and 1; reject incomplete or invalid snapshots without writing.
- Return consistent errors for malformed requests and missing presets.
- Preserve creation timestamps during replacement.
- Keep separate presets even when their names match.
- Isolate owners and preserve access when rotating credentials for the same owner.
- Distinguish database readiness from liveness and drain requests before pool cleanup.

## Scope after MVP

Multiple user accounts, tags and search, favorites, public sharing, import/export, revision history, and audio previews can follow the core save-and-recall workflow.

Explore SQLite separately at a later point; PostgreSQL is the database for this project.

## Decisions to resolve next

Authentication, private preset ownership, generated API contract documentation,
startup validation, readiness, and graceful shutdown are complete.
Prioritize deployment preparation. Engine mappings remain deferred until
frontend integration.

1. Which deployment environment will host the Node.js service and PostgreSQL?
2. Are all nine controls continuous 0–1 values, or do any need physical units or discrete options?
3. What do the macro controls mean, and which synth engine version defines their mapping?

## Implementation sequence

Completed: Hono routes, validation, PostgreSQL persistence, tracked migrations,
HTTP and repository regression tests, Bearer authentication, owner-scoped queries,
two-owner isolation, secret rotation checks, both local ownership migrations,
Drizzle ORM queries, generated OpenAPI documentation through Zod OpenAPI, startup
configuration validation, database readiness, graceful shutdown, pool cleanup,
and HTTP persistence across API process restarts.

1. Choose hosting and PostgreSQL services, configure HTTPS, secrets, and backups,
   and document the migration and deployment workflow.
2. Deploy and verify the hosted API directly.
3. Later, build the synth client and connect its save, list, and recall controls.
