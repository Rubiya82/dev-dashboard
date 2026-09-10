# 08. Codex Implementation Plan

초기 단계별 계획입니다. 현재 수용 기준/실행 방식은 14_CURRENT_DESIGN.md, 검증 결과는 IMPLEMENTATION_STATUS.md를 우선합니다.

각 Task는 독립적으로 수행하고 완료 보고 후 다음 Task로 진행한다.

## TASK-001 — Repository Bootstrap

### Goal
폴더 구조, 정적 entry, 샘플 데이터, schema validator 기반을 만든다.

### Work
- README/AGENTS 확인
- `web/index.html`
- `web/assets/styles.css`
- `web/assets/app.js`
- `web/data/index.json`
- sample task files
- schemas 추가

### Acceptance
- 외부 CDN 없음
- localhost에서 200 응답
- Console error 없음
- sample tasks 렌더링

---

## TASK-002 — Data Loader + Compatibility Layer

### Goal
schemaVersion 기반으로 task를 로딩한다.

### Work
- index loader
- task loader
- field validation
- unknown additive fields preserve
- v1 normalizer

### Acceptance
- malformed task는 전체 화면을 죽이지 않고 오류 표시
- v1 sample 3개 모두 로드
- 날짜가 timezone 때문에 하루 이동하지 않음

---

## TASK-003 — Dashboard + Filters

### Goal
요약 KPI, 검색, category/status filter, task cards 구현.

### Acceptance
- 3 category 모두 filter 가능
- progress/status 표시
- 300개 mock task에서도 정상 동작

---

## TASK-004 — Gantt v1

### Goal
같은 task data에서 간트를 렌더링.

### Work
- month scale
- task bars
- progress overlay
- today line
- milestone/release markers
- horizontal scroll

### Acceptance
- start/target/actual 규칙 준수
- 완료 task actualEnd 우선
- missing target date를 거짓 날짜로 만들지 않음

---

## TASK-005 — Detail + Logs/Decisions/Releases

### Goal
task detail viewer/editor.

### Acceptance
- add/edit/remove
- unsaved changes indicator
- XSS-safe text rendering
- release marker Gantt 반영

---

## TASK-006 — Web Download Save

### Goal
Pages에서 수정된 task JSON을 내려받는다.

### Work
- dirty file tracking
- single-file download
- all-changes ZIP 또는 multi-download 전략 검토
- index.json 변경 포함

### Acceptance
- 다운로드 파일 재로딩 시 데이터 동일
- Git diff가 읽기 쉬운 2-space JSON

---

## TASK-007 — Local File System Save

### Goal
지원 브라우저에서 repo data folder에 직접 저장.

### Work
- feature detect
- directory permission
- correct relative path
- fallback download

### Acceptance
- API 미지원이어도 편집/다운로드 정상
- 사용자의 명시적 폴더 승인 전 write 없음

---

## TASK-008 — Git Helper

### Goal
로컬에서 status/diff/commit/push.

### 권장
PowerShell 또는 Python 최소 HTTP helper. 회사 표준에 따라 선택.

### Safety
- 127.0.0.1 only
- fixed repo root
- no raw shell command parameter
- commit message length/character validation
- push confirmation

### Acceptance
- status/diff 표시
- commit only changed dashboard files option
- 실패 시 stderr를 사용자에게 표시
- push 실패가 data save를 롤백시키지 않음

---

## TASK-009 — Validation / Hardening

- schema tests
- data migration fixture
- 500 tasks perf fixture
- responsive checks
- Pages deployment checklist
- security checklist

---

## TASK-010 — Optional Enterprise REST API

회사 정책 확인 후에만 시작.

- `/api/v3` 접근 확인
- token strategy 보안 검토
- contents endpoint proof-of-concept
- static JS에 credential 저장 금지

---

## TASK-011 — Personal GitHub Deployment

### Goal
동일한 정적 애플리케이션을 `Rubiya82` 소유의 전용 GitHub 저장소와 project-subpath Pages에서 안전하게 배포할 수 있게 한다.

### Work
- credential 없는 multi-host 공개 설정
- `web/` artifact Pages workflow
- 개인/Enterprise 배포 및 기밀 분리 체크리스트
- secret pattern 검증

### Acceptance
- root-relative asset 경로 없음
- 개인 GitHub owner/config 분리 가능
- 회사 데이터의 공개 저장소 복사 방지 절차 문서화
- 저장소 생성 및 live push는 사용자의 명시적 승인과 인증이 있을 때만 수행
