# Development History Dashboard Skill

Use this skill only for tasks in this repository.

## Read first
1. `/AGENTS.md`
2. `/docs/04_DATA_MODEL.md`
3. `/docs/08_CODEX_IMPLEMENTATION_PLAN.md`
4. relevant task docs

## Implementation procedure
1. Restate the current TASK scope in one paragraph.
2. Inspect existing files before editing.
3. Keep production runtime dependency-free.
4. Implement the smallest complete vertical slice.
5. Add/update fixtures and validation.
6. Run tests/smoke checks.
7. Report changed files, acceptance results, compatibility, limitations.

## Data rule
Never couple persisted JSON schema to a specific visual component. Gantt, card, table, and detail view are projections.

## Date rule
Treat `YYYY-MM-DD` as a calendar date, not a timestamp. Avoid implicit UTC/local conversion.

## Save rule
- Pages: edit in memory, then download.
- Local: direct write only after user-granted file/folder access.
- Git: browser does not execute shell; use helper.
- API: Phase 5+ only.

## Security rule
No credentials in repository or browser persistence. No arbitrary shell execution. Escape all task/log/decision text.
