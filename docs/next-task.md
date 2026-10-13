# Next learning task: missing-resource HTTP tests

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
- Every persistence test cleans up only its disposable records in `finally`.
  Database test files run sequentially to keep list totals stable.
- `npm run test:db` runs both persistence test files against `nora_synth_test`.
  The tests validate the database name before importing the app or repository,
  and close the pool with `after()`.

## Next exercise

The learning goal is to finish the standalone API before connecting a frontend.
The original CRUD persistence exercises are complete; the next lessons cover
remaining error behavior, migrations, the API contract, and service operation.

Add HTTP persistence tests for GET, PATCH, and PUT using a valid UUID that does
not exist. Each request should return HTTP 404 with the existing `NOT_FOUND`
error envelope. PATCH and PUT must not create a record when the ID is missing.

First step: inspect the dedicated deletion test in `src/app.persistence.test.ts`.
It already demonstrates a missing-resource response after deletion. Use a
server-created disposable preset, delete it, and exercise GET, PATCH, and PUT
against that ID. Send valid bodies for PATCH and PUT so validation does not
reject the requests before they reach the missing-resource logic. Keep cleanup
in `finally` and leave unrelated test records intact.

After those checks, verify that rejected updates preserve existing stored data
and that unexpected errors produce a safe HTTP 500 response. These are separate
small exercises; start with missing-resource behavior.

Verify with Docker PostgreSQL running:

```sh
npm run test:db
npm test
npm run typecheck
```

## Remaining API lessons

1. Finish missing-resource, failed-update, and safe server-error coverage.
2. Add a migration runner that records applied migrations and runs only pending SQL.
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
