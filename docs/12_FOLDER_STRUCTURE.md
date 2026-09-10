# 12. Recommended Folder Structure

```text
DevelopmentHistoryDashboard/
├─ AGENTS.md
├─ README.md
├─ .codex/
│  └─ skills/
│     └─ development-history-dashboard/
│        └─ SKILL.md
├─ docs/
│  ├─ 00_PROJECT_BRIEF.md
│  ├─ 01_RESEARCH_NOTES.md
│  ├─ 02_REQUIREMENTS.md
│  ├─ 03_ARCHITECTURE.md
│  ├─ 04_DATA_MODEL.md
│  ├─ 05_WORKFLOW.md
│  ├─ 06_UI_UX_DESIGN.md
│  ├─ 07_SKILLS.md
│  ├─ 08_CODEX_IMPLEMENTATION_PLAN.md
│  ├─ 09_VALIDATION_PLAN.md
│  ├─ 10_SECURITY_AND_ENTERPRISE.md
│  ├─ 11_FUTURE_ROADMAP.md
│  └─ 12_FOLDER_STRUCTURE.md
├─ schemas/
│  └─ task.schema.json
├─ tools/
│  ├─ README.md
│  └─ Serve-Dashboard.ps1
└─ web/
   ├─ index.html
   ├─ assets/
   │  ├─ app.js
   │  └─ styles.css
   └─ data/
      ├─ index.json
      └─ tasks/
         ├─ TASK-ALARM.json
         ├─ TASK-AUTOPLATFORM.json
         └─ TASK-VISION.json
```

구현 완료 후에는 다음 운영 파일도 사용한다.

```text
.github/workflows/pages.yml
docs/DEPLOYMENT.md
docs/IMPLEMENTATION_STATUS.md
docs/REST_API_ADAPTER.md
tests/fixtures/
tools/Test-Dashboard.ps1
tools/git-helper/
web/config.js
```

## 나중에 추가 가능한 폴더

```text
tests/
migrations/
tools/git-helper/
web/assets/components/
web/assets/storage/
```

v1에서 필요하기 전에는 빈 추상 구조를 과도하게 만들지 않는다.
