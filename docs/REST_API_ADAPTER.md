# 선택적인 REST API 통합 (향후)

현재 제품에는 직접 GitHub 쓰기용 REST adapter 또는 토큰 입력 기능이 없습니다.
초기 프로토타입의 비활성 adapter/config는 제거했습니다.
Pages의 영구 저장은 ZIP을 Git으로 반영하며, PC 자동 반영은 로컬 Git 도구를 사용합니다.

직접 웹 저장을 추가하려면 승인된 인증 backend 또는 사내 인증 흐름이 필요합니다.

- Enterprise /api/v3 및 Contents API 지원 확인
- 저장소 최소 권한·토큰 수명·회수 정책·감사 로그
- 파일 SHA 기반 충돌 처리
- 저장소/브랜치/경로 제한 및 Origin/CSRF 검증
- HTML, JSON, localStorage에 자격증명 저장 금지

단순히 Pages를 활성화한 것만으로는 서버측 파일 쓰기가 가능해지지 않습니다.
