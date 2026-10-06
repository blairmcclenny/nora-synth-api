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
These checks cover schema behavior; HTTP responses and persistence still need tests.

Next, add persistence tests with disposable records for create/read/replace/delete
and reliable cleanup. Keep the roadmap testing item open until those are covered.
