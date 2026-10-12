# Nora Synth API learning workflow

## Teach before implementing

This is a learning project. Default to coaching so the user can write the code.

- Read the issue, relevant source, and current tests before suggesting work.
- Explain the task's purpose, expected behavior, and how to verify it.
- Offer a small first step, relevant file locations, and hints or pseudocode.
  Leave the task's implementation for the user to attempt.
- When reviewing an attempt, explain what works and the specific misconception
  or missing behavior. Give the smallest useful hint first, then let the user try.
- Do not edit the user's implementation or reveal the full solution unless they
  explicitly ask to correct it, show the answer, or finish it.
- Requests such as “let's do it” mean start guided work, not automatically solve
  the entire issue. Explicit requests to implement or finish work override this
  default for that request.
- When asked for the answer, provide and apply a clear solution, explain the
  important decisions, and run the relevant checks.
- Prefer small, understandable steps and tests that demonstrate observable
  behavior. Explain new concepts in the context of this project's code.

## Start each task on a feature branch

- Inspect Git status and the current branch before making changes.
- Always create a new feature branch for a new issue or distinct task. Use
  `codex/<short-task-name>` unless the user requests another name.
- Continue an existing task on its own feature branch; do not create a fresh
  branch for every follow-up message about that task.
- Never implement, edit project files, or commit new work directly on
  `development` or `main`. Use them only for synchronization and branch bases.
- Start new work from updated `development` unless the user specifies another
  base. If work must build on an unmerged feature, explain that dependency and
  use that feature as the base.
- Preserve uncommitted changes. Do not reset, discard, or move unrelated work
  into a new task's commit. Ask for direction if existing changes prevent a safe
  switch.
- Fetch the remote and fast-forward the base with `git merge --ff-only`.
  Investigate divergence instead of force-updating a local base branch.

## Local PostgreSQL uses Docker

- Follow [the README Docker workflow](README.md#local-setup) for local database
  setup, readiness, administration, and migrations. This is the user's
  established preference for future sessions.
- Reuse `nora-postgres` (`postgres:18`) through Docker Desktop. Use `docker exec`
  for its bundled `psql` and `createdb`; do not assume host PostgreSQL clients or
  start host PostgreSQL services. Host Node `pg` uses the published port 5432.
- Preserve ignored `.env` credentials and never print full container environment
  or actual connection URLs. `DATABASE_URL` targets development `nora_synth`;
  `TEST_DATABASE_URL` targets separate `nora_synth_test` for persistence tests.
- Inspect existing databases and tables before creating or migrating them. Do
  not reset/delete databases, recreate the container, or alter unrelated Docker
  projects as part of routine setup.

## Validate, commit, and push

- Before every commit, format all changed files to match the surrounding project
  style. Use the project's configured formatter when available; otherwise review
  indentation, semicolons, trailing commas, and whitespace manually. Run
  `git diff --check` and inspect the staged diff before committing. Keep formatting
  changes scoped to the files involved in the task.
- Run checks appropriate to the change. For TypeScript and tests, use
  `npm test` and `npm run typecheck`.
- Explain what changed, what passed, and any checks that remain unverified.
- Commit and push when requested; do not infer authorization to merge a pull
  request from authorization to push a branch.
- After every successful push of a branch to the remote, include a clickable
  Markdown link to that remote branch in the final response so the user can
  open it from the Codex app. Use the repository's actual remote URL and pushed
  branch name; also include the pull request link when one exists.
- Keep commits scoped to the current task. The user handles remote merging
  unless they explicitly delegate it.

## Clean up after a confirmed remote merge

The user's confirmation that a feature was merged authorizes routine cleanup
of that completed feature branch. Never delete a branch before that confirmation.

1. Check for uncommitted changes and fetch the remote with pruning enabled.
2. Verify the feature's commits are included in the remote target branch.
   For a squash or rebase merge, inspect the merged pull request or equivalent
   evidence; an ancestry check alone is insufficient. Stop if merge status is
   uncertain or the branch contains additional unmerged work.
3. Switch to the target base, normally `development`, and fast-forward it.
   Update local `main` by fast-forward too when it was included in the remote
   merge workflow.
4. Delete the completed local feature with `git branch -d`. Do not use force
   deletion routinely; if Git refuses after a verified squash/rebase merge,
   explain why and obtain explicit authorization before force-deleting.
5. If the remote feature still exists and has no new commits, delete that exact
   completed remote feature. If it was already deleted, pruning is sufficient.
6. When the user asks to move on, create a new feature branch from the updated
   base before starting the next task.

Report the updated base, deleted branch, new branch if created, and working-tree
status. Never delete `development` or `main` as part of feature cleanup.
