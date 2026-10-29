# Implementation status and next steps

Updated October 29, 2026.

## Completed persistence verification

- `src/repositories/presets.test.ts` covers create/read, complete replacement,
  and deletion, including recall after deletion and repeated deletion.
- `src/app.persistence.test.ts` covers POST creation with HTTP 201 and a
  `Location` header, followed by GET recall with HTTP 200 and full equality.
- HTTP rename coverage includes POST → PATCH → GET: PATCH returns HTTP 200
  and the new name while preserving ID, creation timestamp, schema version,
  and all nine parameters. GET returns HTTP 200 and matches the full PATCH result.
- HTTP replacement coverage includes POST → PUT → GET with exact replacement
  values, preserved ID and creation timestamp, and persisted recall.
- HTTP listing covers default pagination, limit and offset, full preset objects,
  total counts independent of page size, empty pages, and timestamp ordering with
  an ascending UUID tie-breaker. Only disposable fixtures have their timestamps
  adjusted; existing test records are preserved.
- HTTP deletion checks 204 with no body, then GET and repeated DELETE returning
  404 with the `NOT_FOUND` error envelope.
- Missing-resource GET, PATCH, and PUT return 404 with `NOT_FOUND`. Direct
  storage checks confirm that none of these requests recreates the deleted preset.
- Every persistence test cleans up only its disposable records in `finally`.
  Database test files run sequentially to keep list totals stable.
- `npm run test:db` runs both persistence test files against `nora_synth_test`.
  The tests validate the database name before importing the app or repository,
  and close the pool with `after()`.

## Completed migration and error handling

- Rejected PATCH and PUT bodies, including malformed JSON, leave the full stored
  preset unchanged.
- Unexpected database errors return a generic JSON 500 envelope while internal
  details stay out of the response.
- The migration runner discovers SQL files in order, skips tracked files, and
  commits each schema change with its history entry or rolls back on failure.
- Explicit initial-schema adoption compares columns and constraints and preserves
  existing data. Tests cover fresh and repeated runs, adoption, incompatible
  schemas, ordered execution, and rollback in disposable test schemas.
- An advisory lock serializes runners; the build copies SQL files for compiled use.

## Completed authentication and ownership

Authentication and ownership are implemented, merged into `development` and
`main`, and verified locally as of October 16, 2026.

- `requireAuth(expectedSecret, ownerId)` verifies Bearer credentials and attaches
  the stable owner identity to Hono's typed request context only after success.
- Secrets use equal-length SHA-256 digests and `timingSafeEqual`. Missing,
  malformed, and incorrect credentials return the generic JSON 401 envelope.
- `createApp({ secret, ownerId })` takes explicit configuration. The server reads
  `AUTH_SECRET` and `AUTH_OWNER_ID`; tests use fake credentials.
- All preset endpoints require authentication before validation or persistence;
  `/health` remains public.
- Migration 002 adds a required owner column and an index for owner-scoped listing.
  Existing records require an explicit owner assignment through `AUTH_OWNER_ID`.
- Every preset operation and listing total is scoped to the trusted owner.
  Caller-supplied ownership fields are rejected. Inaccessible presets return 404.
- Two-owner tests verify isolation. Secret rotation tests prove the stable owner
  retains access while the old credential is rejected.
- `getPresetById` binds both the preset ID and owner ID parameters.
- Both local databases are migrated. The test database uses `test-owner`; all six
  development presets were assigned to the approved `private-mvp-owner`, with
  every original field preserved. Repeat migration execution skips applied files.
- All 90 unit/HTTP tests, 20 database tests, typecheck, and build passed.

The private MVP supports one configured identity at a time. Multiple real user
accounts and password storage remain outside this phase. Frontend work is deferred.

## Completed OpenAPI documentation

`docs/openapi.json` documents all seven implemented operations, shared schemas,
Bearer authentication, server-derived ownership, pagination, and error responses.
It includes POST's Location header, DELETE's empty 204 response, GET-by-ID path
parameters, and reusable response references.

Run `npm run openapi:validate` to validate OpenAPI structure and resolve references.
The specification is generated from `src/openapi.ts` and the shared Zod schemas.
Run `npm run openapi:generate` after changing those sources; validation fails if
the committed artifact is stale.

## Completed Drizzle and Zod OpenAPI integration

- Preset CRUD now uses typed Drizzle queries over the existing `pg` pool.
  `src/db/schema.ts` mirrors the existing database. Numbered SQL migrations and
  their runner still manage schema changes; no database migration is required.
- `OpenAPIHono` uses shared request/response schemas and route contracts instead
  of separate handwritten validation and OpenAPI definitions.
- The JSON specification is generated and checked for staleness. Contract tests
  verify examples against generated JSON Schemas, including full preset responses.
- Authentication and JSON content-type checks run before automatic validation.
  PATCH and PUT now validate UUID before body when both are invalid.
- Database errors are wrapped by Drizzle; safe HTTP responses remain generic,
  while server logs retain the driver error as the wrapper's cause.

## Completed startup configuration and readiness

- Startup validates PostgreSQL URL structure, authentication, HOST, and PORT before
  listening. Defaults remain 127.0.0.1:3000.
- Public `/health` remains a database-independent liveness check.
- Public `/ready` runs SELECT 1 and returns 200 when reachable, or a safe 503
  NOT_READY envelope on failure. Probes recover when connectivity returns.
- Pool connection acquisition, query, and statement timeouts are each 3 seconds.
- Configuration and readiness tests cover invalid settings, defaults, database
  failure/recovery, and liveness independence. OpenAPI includes both probes.

## Completed graceful shutdown and restart persistence

- SIGINT and SIGTERM stop new connections and drain active HTTP requests before
  calling pool.end(). Repeated signals do not start duplicate cleanup.
- Successful cleanup exits 0; cleanup errors or the 10-second shutdown deadline
  exit 1. The deadline closes remaining HTTP connections before forced exit.
- A real HTTP test verifies an active response finishes before pool cleanup.
  Focused tests cover repeated shutdown calls, pool failure, and stalled requests.
- The database suite starts a real API child process, saves a disposable preset,
  sends SIGTERM, restarts on the same port, and checks full preset equality.
  Both SIGTERM and SIGINT exit cleanly. Cleanup deletes only the test-owned record.
- Validation passed: 118 unit/HTTP tests, 21 database tests, typecheck, build,
  and OpenAPI validation.

## Completed hosting and managed PostgreSQL

The private API is live at <https://nora-synth-api.onrender.com> on Render,
with PostgreSQL on Neon. Render Free and Neon Free are the selected plans;
the committed Blueprint requests `plan: free`, and the user confirmed both
dashboard plan labels are Free. See the [deployment record](deployment.md#deployment-record).

- Both tracked migrations applied to the initially empty hosted database.
- Public HTTPS checks returned 200 for `/health` and `/ready`, and 401 for an
  unauthenticated preset request.
- The hosted verification script exercised authenticated create, recall, list,
  rename, and replacement before pausing for a manual Render redeployment.
- The user reported PASS for full preset equality after redeployment, deletion,
  missing recall, and repeated deletion. The disposable preset was removed.
- Hosted credentials remain in ignored `.env.neon`; local Docker configuration
  remains in `.env`. No local presets were imported into Neon.

## Completed operational closeout

- Both providers' Free plan labels were confirmed by the user.
- After 20 reported idle minutes, health recovered in 22.3 seconds and database
  readiness passed in 0.92 seconds. Unauthenticated access remained rejected;
  the user reported authenticated list, save, full recall, and cleanup PASS.
- A direct TLS database export restored into a separate local Docker database.
  Exact row comparisons passed for both tables, and the public schema matched
  apart from dump metadata. The hosted source was only read.
- The backup archive, checksum, and verification record were copied by the user
  into private durable storage outside the repository. Its exact location is
  user-managed. The disposable local restore database remains available for review.

The initial private API deployment is complete. Ongoing operations include usage
reviews, backups before valuable changes, and hosted checks after releases.

Frontend integration and multi-user authentication remain future work. The
current deployment is a private API for one configured owner.

Regression checks:

```sh
npm run openapi:validate
npm test
npm run test:db
npm run typecheck
npm run build
```

## Completed validation and HTTP rejection coverage

Validation coverage is complete in `src/schemas/preset.test.ts`:

- All nine controls accept 0 and 1 and reject out-of-range and nonnumeric values.
- Every control and top-level field is required; unknown fields are rejected.
- Creation and rename share name trimming, length boundaries, and invalid-input checks.
- Schema version must be the number 1.
- Pagination covers defaults, query-string conversion, boundaries, invalid values,
  and unknown fields.

The loop-generated tests demonstrate table-driven coverage: the same behavior
is checked against several inputs without copying an entire test for each one.
Error paths are asserted where they identify the invalid field; exact Zod
message wording is avoided so dependency wording changes do not break tests.

Run `npm test` and `npm run typecheck` to verify validation behavior.
HTTP rejection tests are now in `src/app.test.ts` and run with `npm test`.

## How the HTTP tests work

`app.request()` sends a Request directly through Hono's middleware and routes.
It returns a Response whose status, headers, and JSON body we assert. No port is
opened, so the development server does not need to run.

The database pool still gets imported with the app. The test sets a dummy
connection string before dynamically importing it, then replaces `pool.query`
with a function that fails immediately. The final check asserts there were zero
query calls. This proves health and invalid requests never reached persistence.
`after()` restores the query function and closes the pool when the file finishes.

Coverage includes health, invalid UUIDs, unsupported content types, malformed
JSON, invalid bodies with field paths, and invalid pagination.
