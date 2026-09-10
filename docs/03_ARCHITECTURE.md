# 03. 현재 구조

확정 요구사항은 [14_CURRENT_DESIGN.md](14_CURRENT_DESIGN.md)를 우선합니다.

## 계층

- core.js: 데이터 검증, 날짜, 계층/순서, MD 관리 영역, ZIP
- storage.js: Workspace 원본/변경 추적, 폴더 읽기/저장, 로컬 도구 클라이언트
- app.js: DOM 기반 화면과 폼, 저장 상태, 편집 이벤트
- app.template.html + styles.css: 화면 틀과 테마
- index.html / web/index.html: 소스와 공개용 가상 샘플을 포함한 실행 HTML
- Python Git helper: 브라우저 밖 저장·검토·커밋·푸시

브라우저는 Git 셸 명령을 실행하지 않습니다. GitHub REST API에도 의존하지 않습니다.
Pages와 로컬 파일 읽기는 같은 Workspace로 연결됩니다.

## 파일

web/data/index.json → tasks/TASK-ID.json → notes/TASK-ID.md + images/TASK-ID/*

JSON은 제목/계층/일정/상태/기록과 이미지 참조를 저장합니다.
MD는 폼 본문/체크리스트/이미지 링크를 저장합니다.
알 수 없는 필드/관리 영역 밖 MD를 보존합니다.

## 실행

Pages는 상대경로 fetch, file://는 내장 샘플 또는 사용자 승인 폴더를 사용합니다.
UI를 바꾸어도 JSON과 MD의 의미는 유지합니다.
유지보수자가 HTML 번들을 갱신할 때만 build_dashboard.py를 사용하고, 실행·배포·데이터 편집 시 빌드가 필요 없습니다.

## 로컬 도구 API

GET /api/snapshot, POST /api/save, POST /api/review, POST /api/publish.
이전 프로토타입의 status/diff/commit/push 개별 API 대신 검토에 연결된 단일 반영 절차를 사용합니다.
