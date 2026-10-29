# Deploy with Render Free and Neon Free

The API runs on Render; PostgreSQL runs on Neon. This is a private MVP with
one configured owner. Keep the bearer secret in trusted API clients. A public
browser application will need a separate authentication design.

## Deployment record

Verified October 29, 2026:

| Item | Recorded configuration or result |
| --- | --- |
| API URL | <https://nora-synth-api.onrender.com> |
| Render service / Blueprint | `nora-synth-api` / `nora-synth` |
| Release branch | `main`, manual deployments |
| Selected plans | Render Free (`plan: free` in Blueprint), Neon Free |
| Neon project / branch | `nora-synth` / `production` |
| Owner identity | `private-mvp-owner` |
| Schema | Migrations 001 and 002 applied |
| Public checks | Health 200, readiness 200, unauthenticated presets 401 |
| Hosted verification | CRUD and recall completed; user reported persistence and cleanup PASS after manual redeployment |

The bearer secret is stored in the user's password manager and Render's
environment settings. Hosted database URLs are in ignored `.env.neon`;
the direct URL is `DATABASE_URL_UNPOOLED`, and the pooled URL is `DATABASE_URL`.
The original `.env` continues to target local Docker PostgreSQL. Never commit
either file or copy their values into documentation.

Operational closeout completed October 29, 2026:

- The user confirmed Render's Compute Plan and Neon's plan are labeled Free.
  Continue reviewing usage dashboards as part of ongoing operations.
- After the user reported 20 minutes of inactivity, `/health` returned 200 in
  22.3 seconds, `/ready` returned 200 in 0.92 seconds, and unauthenticated preset
  access returned 401. The user then reported PASS for authenticated list, save,
  full recall, and cleanup after wake-up.
- A custom-format logical backup was exported through Neon's direct endpoint
  using full TLS certificate verification and PostgreSQL 18 Docker tools.
  The Docker image required a public CA bundle for certificate verification.
- The archive restored successfully into the isolated local database
  `nora_restore_check_1793314369051`. Every row in `presets` and
  `schema_migrations` matched the hosted source. The public schema matched after
  excluding random dump restriction markers and the server-build comment.
  The live database was only read; local development and test databases were
  unchanged. The isolated restore database was retained for review.
- The user confirmed copying `nora-synth.dump`, `SHA256SUMS`, and
  `VERIFICATION.txt` to private durable storage outside the repository. The exact
  storage location is user-managed and was not supplied. The original temporary
  export is not the retained backup location.

All initial operational closeout checks are complete. Create new backups before
valuable data or schema changes; this drill verifies one snapshot, not scheduled
backups. Keep credentials and private backup locations out of tracked files.

The following sections remain the setup and release runbook. For subsequent
releases, apply pending migrations from the intended release checkout, manually
deploy `main`, then repeat hosted verification. For a documentation-only release,
there are no schema changes to apply.

## 1. Create the Neon database

Create a Free Neon project, preferably in an AWS US West region near Render's
Oregon service. Select PostgreSQL 18 to match local development when available.
Create a dedicated hosted database for Nora; leave the local Docker databases
and their `.env` settings unchanged.

From Neon's Connect dialog, save both connection strings securely:

- Pooled connection: use for Render's `DATABASE_URL`.
- Direct connection (pooling disabled): use for migrations and logical backups.

Preserve Neon's TLS connection parameters. Never disable certificate validation
or commit connection strings. The existing `pg` driver accepts these URLs without
a Neon-specific driver. The migration runner uses a session advisory lock, so
it must use the direct endpoint rather than transaction pooling.

## 2. Apply migrations before deploying

Use the exact release checkout that will be deployed. Build locally with Node 24:

```sh
npm ci
npm run build
```

In a temporary terminal session, read the direct Neon URL without echoing it or
putting it in shell history (zsh):

```sh
read -rs 'DATABASE_URL?Neon direct database URL: '
printf '\n'
export DATABASE_URL
export AUTH_OWNER_ID=private-mvp-owner
node dist/db/migrate.js
unset DATABASE_URL AUTH_OWNER_ID
```

Use the same stable owner ID on Render. For existing data, inspect the database
before migrating and confirm which owner should receive it. Do not use
`--adopt-existing` for a fresh Neon database. The runner reports applied migrations;
repeat execution should report zero pending migrations. It does not import local
presets: transferring existing data is a separate operation.

Render Free has no pre-deploy command or interactive service shell. Migrations
therefore run explicitly from the release checkout before a manual deployment;
they do not run in the build or on every API wake-up. Future schema changes must
remain compatible with the running release until the new deployment completes.

## 3. Create the Render service

After the deployment files are merged into `main`, create a Render Blueprint
from this repository and use the root `render.yaml`. Review the plan as Free.
The Blueprint targets `main` and disables automatic deployments so each release
can be coordinated with migrations. Blueprint creation still triggers an initial
deployment, so complete migrations first.

Enter the prompted secrets in Render:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled URL with its TLS parameters |
| `AUTH_SECRET` | A long random bearer secret stored in your password manager |
| `AUTH_OWNER_ID` | The stable owner ID chosen above |

Generate a secret using a password manager. Never paste credentials into source
files, issues, or chat. Keep `AUTH_OWNER_ID` stable when rotating `AUTH_SECRET`.
Render supplies `PORT`; the Blueprint sets `HOST=0.0.0.0` and Node 24. It builds
with development dependencies available for TypeScript compilation, then starts
the compiled server directly. Render terminates HTTPS at its managed endpoint.

The service uses `/health` for routine liveness checks, avoiding repeated database
queries that could prevent Neon from suspending. Check `/ready` separately:
liveness does not prove database connectivity or migration state. Render Free
does not support configuring `maxShutdownDelaySeconds`, so the Blueprint omits
it and uses the platform's shutdown behavior. The application retains its
10-second graceful shutdown deadline.

## 4. Verify the hosted release

Use the assigned HTTPS `onrender.com` URL in an API client. Store the bearer
secret as a private client variable.

1. Confirm `/health` returns 200 and `/ready` returns 200.
2. Confirm preset requests without credentials return 401.
3. Save a disposable preset, list it, recall it, rename it, and replace it.
4. Manually redeploy the same release, then recall the preset and compare all
   stored values to verify persistence across API process replacement.
5. Delete the disposable preset; confirm GET and repeated DELETE return 404.
6. After an idle period, repeat readiness and authenticated recall to check both
   Render wake-up and Neon connection recovery. Allow about a minute for Render
   to wake. Neon waking may exceed the current three-second connection timeout;
   record any failures before deciding whether timeout changes are needed.

Run repository checks before releasing: `npm test`, `npm run typecheck`,
`npm run build`, `npm run openapi:validate`, and `npm run test:db` against the
separate local Docker test database. Never point persistence tests at Neon.

## Free-tier operations and recovery

Render Free sleeps after 15 idle minutes and provides 750 running hours per
workspace per month. Neon Free suspends inactive compute and has storage,
compute, and transfer limits. Review both dashboards for current allowances;
avoid uptime pings intended to keep either service awake.

Free tiers do not provide a production availability commitment. Neon's Free
restore history is limited; it is not a long-term backup policy. Before valuable
data or schema changes, export a logical backup using PostgreSQL 18's `pg_dump`
through Docker and the direct TLS endpoint. Keep credentials out of command
arguments and history, store backups securely outside the repository, and test
restoration into a separate disposable database before relying on them. Never
restore over the live database as a routine verification step.

## Provider references

- [Render Free limits](https://render.com/docs/free)
- [Render Blueprint fields](https://render.com/docs/blueprint-spec)
- [Neon connections](https://neon.com/docs/connect/connect-from-any-app)
- [Neon pricing and free allowances](https://neon.com/pricing)
