# GitHub 저장 오류 조사와 같은 탭 재시도

기존 원격 배포 기준: `987e84c5f547585e55ae96b234922ef8b35e86b9`.
독립 수정 브랜치: `development/github-save-fix-20261018`.

## 확인한 사실

- 사용자는 휴대폰의 Dropbox OAuth 성공 후 `GITHUB_NETWORK_OR_CORS_FAILED`를 보고했다. 휴대폰의 원 요청 기록은 확보되지 않았다.
- 기존 오류는 읽을 수 있는 HTTP 401/403과 다르다. 브라우저 fetch 거부 또는 응답 스트림 실패 등에서 발생한다. 브라우저 JavaScript만으로 DNS/TLS, 네트워크 필터, CORS를 항상 구별할 수는 없다.
- 실제 GitHub OPTIONS는 Authorization, Content-Type, X-GitHub-Api-Version과 PUT을 허용한다. 버전 헤더를 원인으로 단정하거나 제거하지 않았다.
- 무료 GitHub Actions의 실제 모바일 Chromium에서 기존 공개 페이지를 열고 검사했다. 공개 저장소 GET은 HTTP 200, 기존 core의 의도적으로 무효인 검사값 요청은 읽을 수 있는 `GITHUB_HTTP_401`이었다. cache default/no-store 및 redirect error/manual 비교 모두 읽을 수 있는 401이었다. 실제 Secret 변경 요청은 없다.
- 따라서 원래 휴대폰의 통신 실패 원인은 **미확정**이다. 일반적인 GitHub CORS 불지원이나 PAT 권한 부족으로 확정하지 않는다.

읽기 전용 증거: [무료 진단 실행](https://github.com/dimon3898-sys/world-engine-connect/actions/runs/39106636718), `verification/a3b8dd6291ccbb24cf8b166a1969dbf48b06d78e/GITHUB_NETWORK_DIAGNOSIS.json`.

## 실제 수정

- GitHub 요청 실패 후 빈 입력으로 메모리에 남은 권한값을 덮어쓰던 재시도 결함을 수정했다.
- **GitHub 단계만 다시 시도** 버튼으로 해당 단계만 재시도한다. Dropbox grant와 GitHub 권한은 같은 탭의 메모리에만 유지한다.
- HTTP 오류, 브라우저 offline, 자체 30초 timeout, 원인 미확정 fetch 실패를 구분한다. 원문 에러·토큰·요청 URL을 로그에 남기지 않는다.
- Secret 저장 완료와 무료 검증 시작을 분리했다. 저장 후 상태 조회가 실패해도 Secret을 다시 PUT하지 않는다.
- 검증 시작 POST의 응답이 유실되면 실행 여부를 조회한다. 모호한 응답을 이유로 같은 작업을 자동 POST하지 않는다. POST 전 검사 실패나 명확한 4xx 거부는 같은 탭에서 다시 시도할 수 있다.
- 저장 후 HTTP 401/403이면 기존 비공개 GitHub 입력 UI를 다시 제공한다. Dropbox 재승인 없이 권한을 교체하고 검증 단계만 이어간다.
- 실제 실행 여부가 확인되지 않으면 **검증 실행 목록 보기**로 기존 무료 workflow를 확인할 수 있다. 확인되지 않은 실행을 성공으로 표시하지 않는다.

## 보존 및 검증 범위

기존 Dropbox OAuth/PKCE, Secret 봉인 암호화, 기존 키·App Secret 보존, 앱·계정 binding, 기존 unbound 인증 교체 차단, callback query 제거는 유지한다. `pagehide`에서 민감값을 버리며 localStorage/sessionStorage에 OAuth 토큰이나 GitHub 권한을 추가 저장하지 않는다.

기존 WORLD ENGINE 저장소·FINAL·Candidate·renderer·영상·claim·실제 Repository Secrets는 수정하지 않았다. GPU·유료 API 실행은 없다.

기존 직접 GitHub API 경로가 실제 CORS 요청을 지원하므로 근거 없이 다른 서버로 토큰을 보내는 fallback은 추가하지 않았다. 서버 처리가 필요해진다면 별도로 승인된 인증 backend와 토큰 비저장·CSRF·권한 검증이 필요하다. 공개 무인증 프록시는 사용하지 않는다.

무료 검사: 기존 core 계약 36개 재사용, transport 분류 6개, 모바일 재시도 8개 시나리오. 모바일 synthetic Secret PUT는 실제 libsodium으로 암호화하고 검사 키로 복호화해 검증한다. 실제 계정의 Secret 저장·Dropbox 백업 성공을 모의 검사 PASS로 대체하지 않는다.

## 휴대폰에서 최소 작업

1. 새 화면에서 이미 Dropbox 승인을 받았다면 새로고침하지 말고 **GitHub 단계만 다시 시도**를 누른다.
2. 401/403 안내가 나오면 GitHub 권한을 확인하거나 비공개 입력칸에 교체한 뒤 **권한 확인**을 누른다. Dropbox 승인은 다시 하지 않는다.
3. **연결 저장 · 무료 백업 검증**을 누르고 실제 proof 결과를 기다린다. 저장이 끝났다면 버튼은 검증 상태 확인만 재개한다.

이미 열어둔 구버전 탭도 Dropbox grant를 메모리에 유지한다. 그 탭을 닫거나 새로고침하기 전에 GitHub 입력칸에 권한값을 다시 넣고 **권한 확인**을 눌러 기존 승인으로 재시도할 수 있다. 구버전 탭은 배포만으로 새 코드가 되지 않는다.

새 배포를 불러오기 위해 새로고침하거나 탭을 닫으면 이전 메모리의 승인 정보는 복원할 수 없다. 이 경우에만 Dropbox 승인이 한 번 더 필요하다. 이를 피하려고 토큰을 브라우저 저장소나 URL에 보관하지 않는다. Dropbox 앱·Redirect URI 설정은 다시 할 필요가 없다.

같은 오류가 계속되면 토큰이나 스크린샷의 민감값 없이 화면의 오류 코드와 실패 단계만 확인한다. 실제 계정 저장 성공과 원래 휴대폰 통신 원인은 소유자 재시도 결과 전까지 미확인이다.
