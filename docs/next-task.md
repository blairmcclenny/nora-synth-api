# Next learning task: automated validation tests

PUT is implemented. Start automated testing with schemas, which need no database.
Run `npm test` and open `src/schemas/preset.test.ts`.

## First exercise

Add a test that rejects a filter value above 1. Copy `validPreset` using object
spreads, including a fresh nested `parameters` object, and set filter to 1.1.
Call `createPresetInputSchema.safeParse(input)` and assert `result.success` is
false. Narrow the result with an `if` statement, then check that an issue has
the path `parameters.filter`.

Run `npm test`. Temporarily change 1.1 to 0.5 and confirm your test fails;
restore 1.1 and confirm it passes. This proves the test can catch a regression.

## Extend coverage

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

For successful requests we will use real PostgreSQL in a separate test database.
Those tests will check both HTTP behavior and the persisted result.

Next, add persistence tests with disposable records for create/read/replace/delete
and reliable cleanup. Keep the roadmap testing item open until those are covered.
