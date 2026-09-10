# AGENTS.md — Codex Implementation Contract

## Mission

Build a dependency-light development history dashboard that runs on GitHub Enterprise Pages and locally in a browser. Preserve long-term data compatibility even when the UI is redesigned.

## Non-negotiable constraints

- Runtime: static HTML, CSS, vanilla JavaScript.
- No npm, Node.js, MkDocs, React, Vue, Angular, database, or build step for v1.
- No external CDN/runtime dependency in the production path.
- Do not change persisted field semantics without a schema migration.
- Persist `schemaVersion` in every task file.
- UI is replaceable; data model is the contract.
- Must support the three categories: `assigned`, `personal`, `project`.
- A task can have many logs, decisions, milestones, and releases.
- Gantt must derive from the same task date fields used by cards/detail views.
- Web mode must never claim it committed to Git. It downloads changed data files.
- Local direct-save must feature-detect File System Access API and provide download fallback.
- Git commit/push automation must live outside the browser in an optional localhost helper.
- Never store PAT/token credentials in repository files or browser localStorage.
- Treat GitHub Enterprise REST API integration as optional Phase 5 only.

## Architecture boundaries

- `web/`: presentation and browser-side application.
- `web/data/tasks/`: persisted task documents.
- `schemas/`: schema contracts.
- `tools/`: local helper scripts/services.
- `docs/`: requirements, decisions, validation, operations.
- `.codex/skills/`: reusable task-specific implementation guidance.

## Quality gates

Every task must end with:
1. Changed-file list.
2. Manual test result.
3. Automated validation result where applicable.
4. Backward compatibility statement.
5. Known limitations.
6. Next recommended task.

Do not begin a later phase while the previous phase's acceptance criteria are failing.
