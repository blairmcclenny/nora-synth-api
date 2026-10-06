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

- Accept parameter boundaries 0 and 1.
- Reject negative, missing, and unknown parameters.
- Reject blank names and names longer than 100 characters.
- Reject unsupported schema versions and unknown top-level fields.
- Test rename validation and pagination defaults and invalid values.

Use separate tests for separate behaviors. Finish with `npm test` and
`npm run typecheck` passing. The supplied test demonstrates arrange, act,
assert: prepare input, call the schema, check the output.

Next, add persistence tests with disposable records for create/read/replace/delete
and reliable cleanup. Keep the roadmap testing item open until those are covered.
