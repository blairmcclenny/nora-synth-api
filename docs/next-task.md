# Next learning task: HTTP replacement persistence

Updated October 12, 2026.

## Completed persistence exercises

- `src/repositories/presets.test.ts` covers create/read, complete replacement,
  and deletion, including recall after deletion and repeated deletion.
- `src/app.persistence.test.ts` covers POST creation with HTTP 201 and a
  `Location` header, followed by GET recall with HTTP 200 and full equality.
- The HTTP rename exercise covers POST → PATCH → GET: PATCH returns HTTP 200
  and the new name while preserving ID, creation timestamp, schema version,
  and all nine parameters. GET returns HTTP 200 and matches the full PATCH result.
- Both HTTP tests delete disposable records in `finally` and check HTTP 204.
- `npm run test:db` runs both persistence test files against `nora_synth_test`.
  The tests validate the database name before importing the app or repository,
  and close the pool with `after()`.

## Next exercise

Add a successful POST → PUT → GET test in `src/app.persistence.test.ts`.
This extends the repository replacement exercise through HTTP validation,
response handling, and persistence.

1. Create a disposable preset with POST and assert HTTP 201.
2. PUT a complete replacement body with a different name and parameter values.
3. Assert HTTP 200, the replacement name, schema version, and all nine parameters.
4. Check that ID and `createdAt` remain unchanged.
5. GET the preset, assert HTTP 200, and compare the full result with the PUT response.
6. Delete the record in `finally` and assert HTTP 204.

First step: use the rename test's setup and cleanup as a guide. Define the
replacement as `CreatePresetInput`; PUT needs the complete snapshot accepted by
POST, while PATCH accepts only a name. Write the test yourself before asking for
a review.

With Docker PostgreSQL running, verify with:

```sh
npm run test:db
npm test
npm run typecheck
```

After replacement, add dedicated HTTP tests for list pagination and deletion,
including GET and repeated DELETE returning 404 after a successful deletion.
Keep those roadmap items open until their behavior is covered.

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
