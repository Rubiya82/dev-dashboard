# 01. Research Notes

조사 기준일: 2026-09-10

## GitHub Pages / GitHub Enterprise Pages

GitHub Pages는 저장소의 HTML/CSS/JavaScript를 정적 사이트로 게시할 수 있으므로 별도 프레임워크 없이 대시보드를 구성할 수 있다.

GitHub Enterprise Server에서는 Pages 사용 가능 여부와 공개 범위가 **Enterprise 관리자 설정**에 영향을 받는다. 특히 관리자가 Public Pages를 활성화한 경우, private/internal 저장소의 Pages 사이트도 외부 공개될 수 있다는 공식 경고가 있으므로 민감한 개발 이력 게시 전에 회사 설정 확인이 필수다.

참고:
- https://docs.github.com/en/enterprise-server@3.21/pages/getting-started-with-github-pages/what-is-github-pages
- https://docs.github.com/en/enterprise-server@3.21/admin/configuring-settings/configuring-user-applications-for-your-enterprise/configuring-github-pages-for-your-enterprise
- https://docs.github.com/ko/enterprise-server@3.17/pages/getting-started-with-github-pages/creating-a-github-pages-site

## GitHub Enterprise REST API — 향후 2차 경로

GitHub Enterprise Server REST API는 repository contents에 대해 파일 생성/수정 endpoint를 제공한다. 파일 업데이트에는 기존 blob SHA가 필요하며, write 권한이 있는 repository contents 권한/토큰이 필요하다.

대표 endpoint 형태:

`PUT http(s)://HOSTNAME/api/v3/repos/OWNER/REPO/contents/PATH`

따라서 사내 정책이 허용된다면 웹 화면에서 직접 커밋하는 구조로 확장 가능하다. 그러나 토큰을 정적 Pages JavaScript에 넣으면 안 되므로 인증 프록시/승인된 방식이 없는 한 v1에는 적용하지 않는다.

참고:
- https://docs.github.com/en/enterprise-server@3.17/rest/repos/contents
- https://docs.github.com/en/enterprise-server@3.21/rest/repos

## File System Access API

브라우저의 File System Access API를 사용하면 사용자가 명시적으로 선택한 로컬 파일/폴더에 쓰기 동작을 수행할 수 있다. 다만 브라우저 지원 범위가 제한적이고 secure context 및 사용자 동작이 요구되므로 **기능 감지 + 다운로드 fallback**이 필요하다.

로컬 개발은 `file://` 직접 실행보다 `http://localhost` 정적 서버 사용을 기본 경로로 한다.

참고:
- https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker

## 결론

v1 권장 구조:

- Git = Source of Truth
- Pages = 정적 Viewer/Editor
- Web 저장 = 수정 파일 Download
- Local 저장 = File System Access API + fallback
- Git commit/push = Local Helper
- REST API = 회사 정책 확인 후 선택적 확장
