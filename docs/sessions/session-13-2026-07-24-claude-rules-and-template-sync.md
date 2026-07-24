# Session 13 — Path-Scoped Claude Rules + Template Repo Sync (2026-07-24)

## What was done

- Added `.claude/rules/api.md` and `.claude/rules/web.md` in this repo, using
  Claude Code's path-scoped rules mechanism (`paths` frontmatter + `@import`)
  so `apps/api/{README,STANDARDS}.md` and `apps/web/{README,STANDARDS}.md`
  load into context automatically whenever Claude reads a file under the
  matching app directory.
- Initially attempted this via a PreToolUse hook injecting a reminder;
  redirected to Claude Code's native `.claude/rules/` path-scoped memory
  feature instead (confirmed via the official docs) — no hook needed.
- Replicated the same two rule files into the sibling template repo this
  project was cloned from (`~/Projects/Perso/typescript-fullstack-template`),
  adapting the relative import paths to that repo's structure (same
  `apps/api`/`apps/web` layout).
- Committed the rules in the template repo (`improve-config` branch, commit
  `32759f2`).
- Ported this repo's `9691f9e` commit ("isolate compose database per
  workspace" — drops `container_name`/fixed host ports on
  `postgres`/`postgres-test` in `docker-compose.yml`, switches
  `db:start`/`db:stop` to `docker compose -p "$(basename "$PWD")"` in
  `package.json`) into the template repo, committed there too (commit
  `4aea1b6`).

## Decisions

- Use Claude Code's built-in `.claude/rules/` path-scoped rules (not a hook)
  to enforce "read app docs before touching app files" — matches the
  mechanism's intended purpose and requires no shell scripting or
  session-state tracking.

## Learnings / tensions surfaced

- Claude Code's `.claude/rules/*.md` supports YAML frontmatter `paths: [...]`
  glob patterns to scope a rule to matching files, and standard
  `@path/to/file` import syntax to pull in full file content (not just a
  reference) — rules trigger when Claude reads a matching file, not on every
  tool call.
- The `.claude/rules/` files in this repo are currently untracked (not
  committed here yet) — only the template-repo copies were committed this
  session.

## Status at end of session

`.claude/rules/api.md` and `.claude/rules/web.md` exist in this repo but are
uncommitted; the same files (plus the docker-compose isolation fix) are
committed in the template repo on `improve-config`, not yet pushed or merged.
No change to PR #28 review fix-up work, which remains the next thing to
resume (see session 12).
