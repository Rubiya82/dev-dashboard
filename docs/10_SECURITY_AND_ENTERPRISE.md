# 10. Security / Enterprise Notes

## Pages visibility

Private repository라고 해서 Pages가 항상 private이라고 가정하지 않는다. GitHub Enterprise Server의 관리 설정에서 Public Pages가 활성화되어 있으면 사이트 공개 범위가 달라질 수 있다.

배포 전 확인:
- Enterprise Pages 정책
- repository visibility
- Pages URL이 사외에서 접근되는지
- 개발 로그에 고객명/장비 IP/인증정보/보안자료가 포함되는지

## Secrets

금지:
- PAT/token을 JS에 hard-code
- token을 JSON task에 저장
- token을 localStorage에 저장
- git credential을 repository에 저장

## Local helper

- 127.0.0.1 bind
- random/ephemeral CSRF-like session token 권장
- Origin 검증
- allowed repo root 고정
- command allowlist
- raw command string 실행 금지
- file path normalization

## HTML injection

task title/log/decision은 사용자 데이터이므로 `innerHTML`로 직접 삽입하지 않는다.
`textContent` 또는 안전한 DOM API를 사용한다.
