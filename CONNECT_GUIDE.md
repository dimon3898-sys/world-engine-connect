# 휴대폰 Dropbox 연결

연결 화면: **https://dimon3898-sys.github.io/world-engine-connect/**

마지막 `/`까지 사용합니다. 기존 WORLD ENGINE·연화록 사이트·GPU에는 변경이 없습니다.

## 1. 기존 Dropbox 앱에 주소 등록

휴대폰에서 [Dropbox App Console](https://www.dropbox.com/developers/apps)을 열고 **기존 백업용 App Folder 앱**을 선택합니다.

1. **Settings → OAuth 2 → Redirect URIs**에 아래 주소를 붙여넣고 **Add**를 누릅니다.

   `https://dimon3898-sys.github.io/world-engine-connect/`

2. **Permissions**에서 `files.content.read`, `files.content.write`, `files.metadata.read`를 확인합니다. 빠진 항목만 선택하고 **Submit**을 누릅니다.
3. **Settings → App key**를 복사합니다. 새 앱을 만들거나 기존 Secret을 삭제하지 않습니다.

## 2. Dropbox 승인

연결 화면의 **Dropbox App key**에 같은 앱의 키를 넣고 **Dropbox 연결 → 로그인 → Allow/허용**을 누릅니다. 같은 탭으로 돌아옵니다. Refresh Token을 직접 복사하지 않습니다.

## 3. 최초 한 번 GitHub 저장 권한 연결

현재 Codex 연동에는 Secret 쓰기 권한이 없으므로 계정 소유자가 이 단계만 승인해야 합니다.

1. 연결 화면의 **GitHub 권한 화면 열기**를 누릅니다.
2. Fine-grained token의 짧은 만료일을 선택합니다. **Only select repositories → yeonhwarok-free**만 선택합니다.
3. **Repository permissions → Secrets: Read and write**, **Actions: Read and write**를 설정하고 **Generate token**을 누릅니다. Contents 쓰기·관리자 권한은 필요하지 않습니다.
4. 생성한 값을 **연결 화면의 GitHub 일회 연결 권한 비공개 입력칸에만** 붙여넣고 **권한 확인**을 누릅니다. 채팅이나 GitHub 파일에 넣지 않습니다.
5. **Dropbox App secret · 최초 설정만** 입력칸이 나타날 때만 같은 Dropbox 앱 **Settings → App secret → Show**에서 복사해 그 비공개 입력칸에 넣습니다. 기존 설정이 있으면 입력칸은 나타나지 않습니다.
6. **연결 저장 · 무료 백업 검증**을 누릅니다.

페이지는 값을 브라우저에서 봉인 암호화해 GitHub Repository Secrets로 전송합니다. 토큰·키는 공개 저장소나 브라우저 영구 저장소에 기록하지 않습니다. GitHub 권한 값은 탭 메모리에만 보관합니다.

## 4. 실제 백업·복구 결과 확인

**실제 Dropbox 토큰 갱신·백업·다운로드·복구 검증을 통과했습니다**가 표시되어야 연결 검증 완료입니다. 단순히 GitHub 작업이 초록색인 것만으로 판단하지 않습니다. **검증 기록 보기**로 상태를 확인할 수 있습니다.

검증은 기존 immutable 실행 이미지의 무료 CPU 경로를 재사용합니다. GPU 배포·렌더링·유료 실행은 없습니다.

기존 앱·계정과의 연결을 확인할 수 없다는 오류가 나오면 기존 Secret을 지우거나 바꾸지 않습니다. 기존 연결을 보존하고 안전한 이관이 필요한 상태입니다. 백업은 있지만 기존 암호화 키가 없는 경우에도 새 키로 대체하지 않습니다.

Dropbox 승인과 GitHub 권한 승인은 계정 소유자만 할 수 있습니다. 이 배포의 HTTPS·모바일 검증과 실제 계정의 백업·복구 검증은 별개입니다.
