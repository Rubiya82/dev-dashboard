# 02. Functional / Non-functional Requirements

초기 요구사항입니다. 인터뷰 이후 변경/추가는 [14_CURRENT_DESIGN.md](14_CURRENT_DESIGN.md)를 우선합니다.

## Functional

### FR-01 과제 분류
과제는 정확히 하나의 primary category를 가진다.
- `assigned`
- `personal`
- `project`

### FR-02 상태
기본 상태:
- `planned`
- `in_progress`
- `blocked`
- `on_hold`
- `completed`
- `cancelled`

### FR-03 진행률
0~100 정수. UI에서 수동 입력을 기본으로 하고, 추후 milestone 기반 자동 계산은 옵션으로 둔다.

### FR-04 일정
- `startDate`
- `targetEndDate`
- `actualEndDate` (nullable)

### FR-05 개발 로그
날짜/시간, 제목, 내용, 태그, 관련 릴리즈/마일스톤을 저장할 수 있어야 한다.

### FR-06 Decision Log
중요 기술 결정, 선택 이유, 대안, 영향 범위를 저장한다.

### FR-07 Release
한 과제에 0..N개 릴리즈.
- version
- releaseDate
- title
- summary
- status
- notes
- artifact/link optional

### FR-08 Milestone
간트에서 선택적으로 보이도록 날짜, 상태, 설명을 저장한다.

### FR-09 Main Dashboard
- 전체/진행중/완료/보류/최근 릴리즈 요약
- category/status 필터
- 텍스트 검색
- Gantt view
- Task cards/list
- Recent releases

### FR-10 Detail
과제 상세는 Overview / Development Log / Decisions / Releases / History 구조를 지원한다.

### FR-11 Web Edit
웹에서 변경 후 수정 파일을 다운로드할 수 있어야 한다.

### FR-12 Local Edit
지원 브라우저에서 로컬 task 파일에 직접 쓰기를 지원하고, 실패/미지원 시 다운로드로 fallback한다.

### FR-13 Git Helper
선택 기능으로:
- status
- diff
- commit
- push
를 로컬 helper로 수행한다.

## Non-functional

- NFR-01: build tool 없이 실행
- NFR-02: 외부 CDN 없이 실행
- NFR-03: 데이터 schema versioning
- NFR-04: 한 과제 파일 손상 시 전체 DB가 깨지지 않도록 과제별 파일 분리
- NFR-05: Git diff가 사람이 읽을 수 있어야 함
- NFR-06: UTF-8 / 한글 지원
- NFR-07: 최신 Edge/Chrome 우선, 미지원 브라우저 fallback
- NFR-08: 100~500 과제 규모에서 사용자 인터랙션이 체감상 즉각적이어야 함
