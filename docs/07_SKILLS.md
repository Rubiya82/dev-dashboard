# 07. Required Implementation Skills

Codex가 작업할 때 필요한 기술 범위.

## Front-end
- Semantic HTML5
- CSS Grid / Flexbox
- Vanilla JavaScript ES2022+
- DOM event handling
- Date-only arithmetic
- Accessible forms
- Responsive layout
- SVG 또는 CSS 기반 Gantt rendering

## Persistence
- JSON serialization/deserialization
- File download via Blob/Object URL
- File System Access API feature detection
- Atomic-ish save strategy: write temp / validate / replace when helper is involved

## Git
- `git status --porcelain`
- `git diff --`
- `git add`
- `git commit`
- `git push`
- path allowlist and command argument safety

## Testing
- JSON Schema validation
- deterministic date calculations
- browser manual smoke tests
- data round-trip tests
- migration tests

## Security
- No embedded token
- No arbitrary command execution
- localhost helper bound to loopback only
- repo root allowlist
- input/path validation
- no HTML injection from user data
