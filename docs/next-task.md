# Implementation status and next steps

Updated October 29, 2026.

## Current status

The standalone private API is deployed at <https://nora-synth-api.onrender.com>.
It supports one configured Bearer secret mapped to a stable owner identity.
Frontend integration and multiple real user accounts are future work.

Implemented and verified:

- Preset create, full recall, paginated listing, rename, replacement, and deletion.
- Shared Zod validation and generated OpenAPI 3.1 contracts.
- PostgreSQL persistence through Drizzle and `pg`, numbered transactional SQL
  migrations, migration history, advisory locking, and explicit legacy adoption.
- Owner-scoped operations, cross-owner isolation, and secret rotation with a
  stable owner ID. Caller-supplied ownership is rejected.
- Safe public errors, startup validation, separate liveness/readiness probes,
  graceful shutdown, and persistence across process restarts.

## Deployment verification

Render Free and Neon Free were confirmed by the user in the provider dashboards.
Both hosted migrations applied successfully. HTTPS health and readiness returned
200; unauthenticated preset access returned 401.

The user completed hosted CRUD checks and reported full preset equality after a
manual Render redeployment, followed by successful deletion and 404 checks.
After 20 reported idle minutes, health recovered in 22.3 seconds and readiness
passed in 0.92 seconds; authenticated list, save, full recall, and cleanup passed.

A direct TLS export restored into a separate local Docker database. Exact row
comparisons passed for both tables, and the public schema matched apart from dump
metadata. The user saved the archive, checksum, and verification record in private
durable storage. The exact storage location is user-managed.

See the [deployment record and runbook](deployment.md) for evidence and operating
instructions. The initial operational closeout is complete; usage reviews,
manual releases, and new backups remain ongoing responsibilities.

## Future work

- Define the synth engine's mapping from normalized controls to sound parameters.
- Choose client authentication before browser integration; never embed the shared
  owner secret in a public bundle.
- Build the client save, list, and recall flow when frontend work is requested.
- Design real multi-user identity separately if the private MVP scope expands.

## Regression checks

Run these for relevant implementation changes and before releases:

```sh
npm run openapi:validate
npm test
npm run test:db
npm run typecheck
npm run build
```

The last full implementation validation recorded 118 unit/HTTP tests and 21
local database tests passing, plus typecheck, build, and OpenAPI validation.
Documentation edits do not imply a fresh run of those implementation tests.
Database tests must use the separate local Docker `nora_synth_test` database;
never point them at hosted data. Both local databases already have tracked
migrations. Preserve local `.env` and hosted `.env.neon` credentials.
