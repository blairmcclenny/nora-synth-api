# Next learning task: tracked database migrations

Updated October 13, 2026.

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

## Next exercise

The learning goal is to finish the standalone API before connecting a frontend.
The original CRUD persistence exercises are complete; the next lessons cover
remaining error behavior, migrations, the API contract, and service operation.

The next hands-on implementation lesson is a migration runner. Today the README
requires manually applying SQL; the runner should discover migration files,
record successful applications, and skip files already applied.

First step: inspect `src/db/migrations/001_create_presets.sql` and `src/db/pool.ts`.
Sketch the information a migration-history table needs and how the runner would
choose pending files in filename order. Leave implementation for the next exercise.

Plan for both fresh databases and the established databases, which already have
`presets` but no migration history. Do not rerun the initial CREATE TABLE migration
or reset those databases. Existing-schema adoption needs an explicit verification
step before recording the initial migration as applied. Each new migration and
its history entry should commit together, with rollback on failure.

Rejected-update persistence and safe HTTP 500 coverage remain open follow-up
items; they are deferred so the next learning session focuses on implementation.

Verify with Docker PostgreSQL running:

```sh
npm run test:db
npm test
npm run typecheck
```

## Remaining API lessons

1. Add a migration runner that records applied migrations and runs only pending SQL.
2. Complete the deferred failed-update persistence and safe server-error coverage.
3. Write an OpenAPI specification for the implemented routes and error envelopes.
4. Validate startup configuration, add database readiness separately from liveness,
   and verify graceful shutdown and persistence across service restarts.
5. Decide authentication, library ownership, and hosting before remote deployment,
   then document and verify the chosen deployment workflow.

The current prototype has one shared local library. Authentication and ownership
remain decisions to resolve; no account system is assumed by this roadmap.
Frontend construction, engine mappings, and save/list/recall integration are deferred.

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
