# 개발 작업실 · Development Workspace

메인 과제와 하위 작업을 웹 폼으로 관리하는 파일 기반 대시보드입니다.
HTML/CSS/JavaScript만으로 동작하며 서버·npm·CDN이 필요하지 않습니다.

## 바로 사용하기

- 공개 사이트: https://rubiya82.github.io/dev-dashboard/
- 로컬 실행: 저장소를 내려받고 **루트의 index.html을 Edge/Chrome에서 더블클릭**합니다.
- 실제 파일 편집: **작업 폴더 열기** → 저장소 루트 또는 web/data 선택 → 폴더 읽기/쓰기 승인.
- HTML 안의 데이터는 공개용 가상 샘플입니다. 실제 데이터는 선택한 폴더에서 읽습니다.

## 할 수 있는 일

- 메인 과제 / 하위 작업 / 선택적인 추가 하위 작업
- 웹 폼으로 추가·수정, 드래그 및 위/아래 버튼으로 재배치, 상위 과제 변경
- 상태·일정·담당자·태그·진행률 관리, 목록과 월 단위 간트
- 일반 텍스트 입력과 문서 미리보기, 체크리스트
- 이미지 붙여넣기·드롭·선택 (PNG/JPEG/GIF/WebP, 장당 8MB)
- 개발 로그·의사결정·마일스톤·릴리즈·변경 이력
- 보관하기/보관 해제 (원본 파일을 삭제하지 않음)

본문은 Markdown, 구조화된 정보는 JSON, 이미지는 별도 파일로 저장됩니다.
Markdown 문법을 직접 입력할 필요는 없습니다. 미리보기는 폼 내용을 보여주며 임의 HTML이나 스크립트를 실행하지 않습니다.

## 저장 방식

| 실행 방식 | 저장 동작 |
|---|---|
| GitHub Pages | 화면에서 편집 → 변경 ZIP 다운로드 → 저장소 루트에 압축 해제 → Git push |
| 로컬 HTML + 작업 폴더 | 화면에서 편집 → 로컬 저장 → MD/JSON/이미지 직접 기록 |
| 로컬 HTML + Git 연결 | 화면에서 편집 → GitHub 반영 → diff 확인 → 저장·커밋·푸시 |

**변경 적용은 화면 반영**, **로컬 저장은 디스크 반영**, **GitHub 반영은 원격 전송**입니다.
Pages의 다운로드만으로 저장소가 바뀌지는 않습니다. 새로고침 전에 파일을 저장하거나 ZIP을 다운로드하세요.

## 로컬 Git 자동 반영

1. PC에 Git과 Python 3.10 이상을 설치하고, 저장소의 Git 인증을 완료합니다.
2. 최초 한 번 `git push -u origin main`으로 upstream을 설정합니다.
3. `Start-GitHub-Sync.cmd`를 실행하고 창을 켜 둡니다.
4. HTML의 **Git 연결 설정** 또는 **GitHub 반영**에서 표시된 연결 코드를 입력합니다.
5. 연결된 저장소의 데이터를 폼에서 편집하고 **GitHub 반영**을 누릅니다.
6. 대상 저장소·브랜치·변경 내용을 확인한 뒤 **저장 · 커밋 · 푸시**를 누릅니다.

외부 도구는 Git 자동 반영에만 필요합니다. HTML 실행과 폴더 직접 저장에 Python/서버는 필요하지 않습니다.
도구를 재실행하면 연결 코드가 바뀝니다. 브라우저가 로컬 네트워크 접근을 요청하면 본인의 도구인지 확인하고 승인하세요.
회사 브라우저 정책이 로컬 파일 기능을 차단하면 ZIP 저장 또는 선택적인 localhost 실행을 사용하세요.

## 공개 데이터 주의

이 저장소와 Pages는 모두 공개입니다. 모든 샘플은 가상이며 실제 과제명은 포함하지 않습니다.
실제 업무, 내부 URL, 고객 정보, 인증정보를 이 저장소에 넣거나 push하지 마세요.
Git 커밋 작성자 이름과 이메일도 공개되므로 GitHub noreply 이메일 사용을 권장합니다.
사내 운영은 별도 Enterprise 저장소와 Pages 접근 정책을 확인한 뒤 진행하세요.

## 파일과 호환성

- `index.html`, `web/index.html`: 배포된 독립 실행 파일
- `web/assets/`, `web/app.template.html`: 유지보수용 소스
- `web/data/index.json`: 과제 목록
- `web/data/tasks/TASK-*.json`: 과제 메타데이터
- `web/data/notes/TASK-*.md`: 본문·체크리스트
- `web/data/images/TASK-*/`: 첨부 이미지 (추가할 때 생성)
- `tools/git-helper/server.py`: 선택적인 로컬 Git 도구

schemaVersion 1을 유지하고 기존 필드 의미와 알 수 없는 확장 필드를 보존합니다.
상위 과제의 화면 진행률은 활성 말단 작업 평균이며 저장된 progress를 덮어쓰지 않습니다.

## 검증 및 유지보수

```powershell
python tools/build_dashboard.py --check
python -m unittest discover -s tests -p "test_*.py" -v
```

소스 수정 시 유지보수자가 `python tools/build_dashboard.py`를 실행해 HTML 두 개를 갱신합니다.
일반 사용자와 Pages 서버에서는 빌드가 필요 없습니다. 데이터만 수정할 때도 빌드가 필요 없습니다.

브라우저 테스트는 테스트용 서버에서 `tests/browser.html`을 열어 실행합니다.
자세한 운영법은 [배포 안내](docs/DEPLOYMENT.md), 설계는 [현재 설계](docs/14_CURRENT_DESIGN.md), 검증 범위는 [구현 현황](docs/IMPLEMENTATION_STATUS.md)을 참고하세요.
