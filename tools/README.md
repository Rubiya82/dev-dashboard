# 도구 사용

기본 실행은 루트 index.html 더블클릭입니다. Serve-Dashboard.ps1은 필요하지 않습니다.

- Start-GitHub-Sync.cmd: 선택적인 Git 저장·커밋·푸시 도구 시작 (Git + Python 3.10+).
- git-helper/Start-GitHelper.ps1: 같은 도구의 PowerShell 진입점.
- Test-Dashboard.ps1: 번들·공개 데이터 검사 및 Python 통합 테스트.
- build_dashboard.py: 유지보수용 HTML 갱신. 사용자 실행 및 데이터 수정에는 필요 없음.
- Serve-Dashboard.ps1: 선택적 HTTP 미리보기/브라우저 테스트용. 기본 실행 경로가 아님.

테스트용 서버: `python -m http.server 8080 --bind 127.0.0.1`
브라우저에서 http://127.0.0.1:8080/tests/browser.html 을 엽니다.
