#!/usr/bin/env bash
# 개발용 빠른 실행 스크립트 — SEA 빌드 없이 소스를 바로 실행합니다.
# 최종 사용자 배포용이 아닙니다(Node.js 설치가 필요함). 배포용은 `npm run build`로 만든
# dist/의 SEA 바이너리를 쓰세요(Node.js 미설치 환경에서도 동작).
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/bin/claudetower.js" "$@"
