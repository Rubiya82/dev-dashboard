# 09. Validation Plan

## Data

### V-DATA-01 Round trip
load → edit → save → reload 후 의미 동일.

### V-DATA-02 Stable fields
UI 변경 전/후에도 필수 안정 필드가 보존.

### V-DATA-03 Unknown fields
향후 필드가 들어와도 구버전 UI가 알 수 없는 필드를 삭제하지 않도록 한다.

### V-DATA-04 Broken file isolation
한 task JSON 오류가 다른 task 렌더링을 막지 않는다.

## Gantt

### V-GANTT-01 Date math
월 경계/윤년/연말을 테스트.

### V-GANTT-02 Timezone
`YYYY-MM-DD`를 Date 생성자에 그대로 넣어 현지 timezone shift시키지 않는다. calendar date helper 사용.

### V-GANTT-03 End date
completed + actualEndDate → 실제 종료일.
그 외 targetEndDate.
완료 상태에서도 actualEndDate 공란을 보존한다.

### V-GANTT-04 Interaction
과제명 손잡이의 위/아래 드래그는 같은 상위 과제 안의 order를 변경한다.
막대 좌우 드래그는 task 시작/목표/실제 종료일을 같은 일수만큼 이동하고 milestone/release 날짜는 유지한다.
마우스 오버와 키보드 포커스에서 최근 상태 요약을 표시한다.

### V-DATA-05 Delete / Archive
보관 전용 보기와 복구가 동작한다.
삭제 시 선택 과제와 모든 하위 작업이 index에서 제거되고 기존 파일은 보존된다.

## Save

### V-SAVE-01 Web
downloaded JSON이 validator 통과.

### V-SAVE-02 Local
권한 거부 시 data 손실 없이 fallback.

### V-SAVE-03 Dirty state
저장 성공 전까지 dirty 표시 유지.

## Git Helper

### V-GIT-01 Loopback
외부 NIC에 bind하지 않음.

### V-GIT-02 Path
repo 외부 파일 stage 금지.

### V-GIT-03 Commit
diff 확인 전 commit 버튼을 활성화하지 않는 UX 권장.

### V-GIT-04 Push
push 실패를 명확히 분리 표시.

## UI

- 1280/1024/768/390 width
- keyboard navigation
- long Korean title
- 0%, 100% progress
- category/status empty results
- 100/300/500 tasks

## Pages deployment

- root URL
- project subpath URL
- relative assets
- cache busting strategy
- private/public visibility 확인
