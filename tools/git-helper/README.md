# 로컬 Git 연결 도구

루트 Start-GitHub-Sync.cmd 실행 → HTML에서 연결 코드 입력.
Git 및 Python 3.10 이상, 기존 Git 인증, origin/현재브랜치 upstream이 필요합니다.
PAT을 HTML에 입력하지 않습니다. 연결 코드는 GitHub 토큰이 아닌 이번 로컬 실행용 난수입니다.

## 안전 경계

- 127.0.0.1 바인딩, Host/Origin 검사, 매 실행 256비트 난수 연결 코드
- file://의 null Origin과 loopback만 허용. 외부 Pages에서는 연결 불가.
- web/data의 과제 JSON·본문 MD·허용된 이미지·index.json만 저장
- 경로 정규식 및 실제 경로 확인, 심볼릭 링크·정션 거부
- 사용자 입력 명령을 실행하지 않고 Git 인자 배열만 사용
- 저장 전 SHA-256 기준 버전 확인, 파일별 재확인, 임시 파일 원자적 교체
- 기존 파일은 .dashboard-backups에 로컬 백업 (Git 제외)
- diff 검토 후 10분 이내 최종 확인 필요, 파일/HEAD/원격 상태 변경 시 재검토
- 이미 스테이징된 파일이 있으면 자동 커밋 중지. 무관한 unstaged 파일은 제외.
- 미푸시 커밋에 데이터 외 변경이 있으면 먼저 Git에서 수동 처리
- 일반 push만 사용. force push·자동 pull/merge·자격증명 변경 없음.
- push 실패 시 이미 저장한 파일과 커밋 보존. 재검토하여 push 재시도.
- Git commit 실패로 staged 파일이 남으면 Git에서 diff 확인 후 commit/unstage 처리.
- 한 파일 8MB, 한 요청 48MB. 큰 이미지 묶음은 나누어 저장하세요.

## API

GET /api/snapshot
POST /api/save {changes:[{path,content:base64,baseHash:sha256|null}]}
POST /api/review (같은 변경 목록)
POST /api/publish {changes,reviewId,message,confirm:true}

GitHub REST API가 아니라 PC 내부 전용 API입니다. 연결 코드는 요청 헤더에만 사용합니다.
브라우저 새로고침/도구 재시작 후 다시 연결합니다.
로컬 네트워크 정책이 차단하면 폴더 직접 저장 + Git 클라이언트를 사용하세요.
