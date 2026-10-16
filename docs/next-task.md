# Next learning task: OpenAPI documentation

Updated October 16, 2026.

## Completed persistence exercises

- `src/repositories/presets.test.ts` covers create/read, complete replacement,
  and deletion, including recall after deletion and repeated deletion.
- `src/app.persistence.test.ts` covers POST creation with HTTP 201 and a
  `Location` header, followed by GET recall with HTTP 200 and full equality.
- The HTTP rename exercise covers POST → PATCH → GET: PATCH returns HTTP 200
  and the new name while preserving ID, creation timestamp, schema version,
  and all nine parameters. GET returns HTTP 200 and matches the full PATCH result.
- The HTTP replacement exercise covers POST → PUT → GET with exact replacement
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

## Completed migration and error exercises

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
- The user completed the lookup learning slice with bound preset ID and owner ID
  parameters in `getPresetById`.
- Both local databases are migrated. The test database uses `test-owner`; all six
  development presets were assigned to the approved `private-mvp-owner`, with
  every original field preserved. Repeat migration execution skips applied files.
- All 90 unit/HTTP tests, 20 database tests, typecheck, and build passed.

The private MVP supports one configured identity at a time. Multiple real user
accounts and password storage remain outside this phase. Frontend work is deferred.

## Next exercise: document the API contract

Create an OpenAPI specification matching the implemented routes, validation,
authentication, ownership behavior, responses, and errors.

Working approach: the user owns one focused learning slice while the assistant
implements the surrounding work. Leave the user's slice untouched until they
request review or ask for the answer.

Proposed user slice: document `GET /v1/presets/{id}`, including its UUID path
parameter and 200, 400, 401, and 404 responses. The assistant will prepare shared
schemas, the Bearer security definition, the other endpoints, and validation.
Explain how the shared references fit together before the user starts.

The specification must cover:

- Public `/health` and every authenticated preset endpoint.
- Complete preset data, rename input, pagination, and listing totals.
- POST's 201 response and `Location` header; DELETE's empty 204 response.
- Validation, malformed JSON, authentication, missing/inaccessible resources,
  unsupported media types, and safe internal errors.
- Server-derived ownership and a stable owner identity across secret rotation.

## Remaining path to deployment

1. Complete and validate the OpenAPI specification and link it from the README.
2. Finish startup configuration validation. Authentication settings and a required
   database URL already have checks; broader runtime configuration remains open.
3. Add database readiness separately from public liveness.
4. Verify graceful shutdown, pool cleanup, and persistence across service restarts.
5. Choose API hosting and managed PostgreSQL, then configure HTTPS, secrets,
   backups, and the migration workflow.
6. Deploy and verify authenticated preset operations, readiness, and restart
   persistence directly against the hosted API. Frontend integration comes later.

Regression checks:

```sh
npm test
npm run test:db
npm run typecheck
npm run build
```

## Completed validation and HTTP rejection exercises

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

Run `npm test` and `npm run typecheck` to verify this slice.
HTTP rejection tests are now in `src/app.test.ts` and run with `npm test`.

## How the HTTP tests work

`app.request()` sends a Request directly through Hono's middleware and routes.
It returns a Response whose status, headers, and JSON body we assert. No port is
opened, so the development server does not need to run.

The tests use `async` callbacks because requests and reading response bodies
return promises. `await` waits for each result before making assertions.

The database pool still gets imported with the app. The test sets a dummy
connection string before dynamically importing it, then replaces `pool.query`
with a function that fails immediately. The final check asserts there were zero
query calls. This proves health and invalid requests never reached persistence.
`after()` restores the query function and closes the pool when the file finishes.

Coverage includes health, invalid UUIDs, unsupported content types, malformed
JSON, invalid bodies with field paths, and invalid pagination.
