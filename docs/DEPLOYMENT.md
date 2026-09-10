# GitHub Pages 배포와 운영

## 개인 공개 배포

저장소 Rubiya82/dev-dashboard → Settings → Pages → Deploy from a branch → main / (root).
루트 index.html은 ./web/data에서 데이터를 읽습니다. .nojekyll로 원본 파일을 게시합니다.
일반적인 데이터 commit/push마다 Pages가 다시 게시하며, 완료 후 브라우저를 새로고침합니다.
Pages 게시에는 수십 초에서 수분이 걸릴 수 있으며, GitHub 반영 성공과 게시 완료는 다른 상태입니다.

선택적인 수동 Actions workflow는 web 폴더만 artifact로 게시합니다. 기본 배포는 branch 방식이며 동시에 사용하지 않습니다.
web/index.html은 ./data를 사용하므로 web 폴더만 게시하는 방식도 지원합니다.

## 로컬 실행

루트 index.html 더블클릭. 데이터 수정 전 작업 폴더 열기 또는 Git 연결로 실제 저장소 파일을 불러옵니다.
HTML에 포함된 가상 샘플은 로컬 실제 파일의 최신 사본이 아닙니다.
이미지와 MD/JSON은 원래 파일 경로를 유지해야 합니다.
독립 HTML 하나만 복사하면 가상 샘플 편집은 가능하지만 실제 데이터 수정에는 데이터 폴더가 필요합니다.

## 공개 범위

개인 계정 Pages는 비공개 저장소여도 웹사이트가 공개될 수 있습니다.
이 배포는 사용자 승인에 따라 저장소와 사이트 모두 공개입니다. 실제 업무/내부 자료는 넣지 마세요.
공개된 파일은 나중에 삭제해도 Git 이력·캐시·제3자 복사본에 남을 수 있습니다.

## Enterprise

관리자가 허용한 저장소/Pages 접근 정책 확인 → 동일 파일 push → branch와 root 선택.
REST API는 기본 기능에 필요하지 않습니다. Actions가 없더라도 branch Pages 방식으로 운영합니다.
Git 인증은 PC에서 조직의 기존 Git 정책을 따릅니다.

## 검증

루트/프로젝트 하위경로 접속, 과제 10개, 간트, 폼 수정, 변경 ZIP, MD·이미지 상대경로를 확인합니다.
검증 도구에서 file:// 접근은 차단되어 실제 더블클릭·폴더 권한 승인 동작은 사용자 PC에서 수동 확인이 필요합니다.
