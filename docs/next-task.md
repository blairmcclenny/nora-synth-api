# Next learning task: authentication and preset ownership

Updated October 14, 2026.

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

## Next exercise

Build toward a private MVP that can eventually support multiple users. The next
learning section is authentication and preset ownership, followed by deployment.
Frontend integration remains deferred.

First, distinguish the two responsibilities:

- Authentication identifies who is calling the API.
- Ownership determines which presets that identity can access or change.

Chosen credential flow: a single private secret sent in the Authorization header
as a Bearer token, mapped on the server to a stable owner identity. Secret rotation
must not change that identity. Password storage is outside this exercise.

### Stopping point: October 14

- `requireAuth(expectedSecret)` returns middleware that verifies Bearer credentials.
- Missing, malformed, or incorrect credentials return the generic JSON 401 envelope
  without reaching the route. Valid credentials reach the route.
- Secrets are compared using equal-length SHA-256 digests and `timingSafeEqual`.
  Empty or whitespace-containing configured secrets are rejected.
- Isolated middleware tests use fake credentials, with no database or network port.
  `npm test` includes these tests; all 80 tests and typecheck passed.
- The middleware is not yet connected to the preset routes. Runtime secret
  configuration and trusted owner identity remain to be added.
- Current branch: `codex/verify-private-credential`, based on the unmerged
  `codex/auth-preset-ownership` branch. Preserve this dependency until merged.

Next guided step: accept a stable owner ID alongside the configured secret, attach
it to Hono's typed request context only after successful verification, and test that
the protected route receives the trusted identity. Then configure the runtime
credential and protect both the preset collection and individual preset routes,
keeping `/health` public and updating HTTP tests to send fake valid credentials.

Then implement in small steps:

1. Verify credentials in middleware and attach a trusted owner identity to requests.
2. Add an owner identifier through a tracked migration, assigning existing shared
   presets explicitly to the MVP owner.
3. Scope create, list, recall, rename, replace, and delete to the authenticated owner.
   Resolve ownership on the server, not from an untrusted request body.
4. Verify missing/invalid credentials return 401 and one owner cannot access another
   owner's presets. Use two test identities even if the MVP serves one person.
5. Document the credential flow and authenticated contract for future clients.

## Deployment preparation

OpenAPI documentation, startup configuration validation, database readiness,
graceful shutdown, and restart persistence verification remain open. Complete
these before remote deployment, alongside the chosen authentication and ownership
implementation. Choose hosting, configure secrets, apply migrations, and verify
the hosted API directly without requiring a frontend.

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
