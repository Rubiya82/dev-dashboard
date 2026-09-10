# 04. Data Model

## 핵심 목표

화면 변경에 영향을 받지 않는 최소 영속 모델을 정의한다.

## Task document

```json
{
  "schemaVersion": 1,
  "id": "TASK-0001",
  "title": "샘플 프로젝트",
  "category": "personal",
  "status": "in_progress",
  "progress": 65,
  "summary": "Edge based matching 개발",
  "startDate": "2026-08-20",
  "targetEndDate": "2026-10-15",
  "actualEndDate": null,
  "tags": ["Vision", "C++"],
  "owners": [],
  "links": [],
  "milestones": [],
  "logs": [],
  "decisions": [],
  "releases": [],
  "createdAt": "2026-08-20T09:00:00+09:00",
  "updatedAt": "2026-09-10T19:00:00+09:00"
}
```

## 필수 안정 필드

다음 필드는 UI가 바뀌어도 의미를 변경하지 않는다.

| Field | Meaning |
|---|---|
| `schemaVersion` | migration 기준 |
| `id` | 영구 식별자 |
| `title` | 과제명 |
| `category` | assigned/personal/project |
| `status` | 진행 상태 |
| `progress` | 0..100 |
| `startDate` | 시작일 |
| `targetEndDate` | 목표 종료일 |
| `actualEndDate` | 실제 종료일 |

이 필드만으로 카드, 리스트, 기본 간트가 모두 그려진다.

## Gantt 파생 규칙

- 시작 = `startDate`
- 종료 = 완료 상태이고 실제 종료일이 있으면 `actualEndDate`, 나머지는 `targetEndDate`
- 완료 과제는 actualEndDate 우선
- targetEndDate가 없으면 milestone 또는 1일 task로 임의 변환하지 말고 UI에 `종료일 미정` 표시
- 진행률 overlay = 말단 과제 `progress`, 상위는 활성 말단 과제 평균 (저장된 progress는 보존)
- milestone marker = `milestones[].date`
- release marker = `releases[].releaseDate`

## Log

```json
{
  "id": "LOG-20260910-001",
  "at": "2026-09-10T15:30:00+09:00",
  "type": "development",
  "title": "Pyramid search 적용",
  "content": "coarse-to-fine 방식 적용",
  "tags": ["matching", "performance"],
  "relatedRelease": "0.3.0"
}
```

## Decision

```json
{
  "id": "DEC-0003",
  "date": "2026-09-10",
  "title": "외부 프레임워크 미사용",
  "decision": "vanilla JS를 유지한다.",
  "reason": "사내 설치 제약과 Pages 배포 단순화",
  "alternatives": ["React", "Vue"],
  "impact": "빌드 체인 없음, UI 모듈화를 직접 설계"
}
```

## Release

```json
{
  "id": "REL-0004",
  "version": "0.4.0",
  "releaseDate": "2026-09-20",
  "status": "released",
  "title": "Gantt view",
  "summary": "간트와 milestone 표시 추가",
  "notes": []
}
```

## Migration rule

현재 추가 필드/MD 저장 규칙은 [14_CURRENT_DESIGN.md](14_CURRENT_DESIGN.md)를 참고합니다.

schema를 수정할 때:
1. 기존 의미 변경 금지.
2. additive change 우선.
3. breaking change 필요 시 `schemaVersion` 증가.
4. `migrations/v1-to-v2` 규칙을 문서화.
5. 과거 파일을 읽는 compatibility loader를 최소 1 major schema 동안 유지.
