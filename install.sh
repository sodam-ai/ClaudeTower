#!/usr/bin/env bash
# ClaudeTower 설치 스크립트 (macOS/Linux, curl -fsSL .../install.sh | sh)
#
# 2026-07-04: 저장소 공개 전환 + main 브랜치 개설 + v0.1.9 릴리스로
# 원라이너 설치(curl -fsSL https://raw.githubusercontent.com/sodam-ai/ClaudeTower/main/install.sh | sh)
# 가 실제로 동작하는 것을 실측 확인했다.
set -euo pipefail

REPO="sodam-ai/ClaudeTower"
INSTALL_DIR="${CLAUDETOWER_INSTALL_DIR:-$HOME/.claudetower/bin}"

detect_platform() {
  local os arch
  case "$(uname -s)" in
    Darwin) os="macos" ;;
    Linux) os="linux" ;;
    *)
      echo "지원하지 않는 운영체제입니다: $(uname -s)" >&2
      exit 1
      ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *)
      echo "지원하지 않는 아키텍처입니다: $(uname -m)" >&2
      exit 1
      ;;
  esac
  # 현재 CI 매트릭스는 macOS arm64/Linux x64만 빌드한다(.github/workflows/build.yml).
  if [ "$os" = "macos" ] && [ "$arch" != "arm64" ]; then
    echo "현재 macOS는 Apple Silicon(arm64)만 지원합니다." >&2
    exit 1
  fi
  if [ "$os" = "linux" ] && [ "$arch" != "x64" ]; then
    echo "현재 Linux는 x64만 지원합니다." >&2
    exit 1
  fi
  echo "${os}-${arch}"
}

main() {
  local platform artifact url
  platform="$(detect_platform)"
  artifact="claudetower-${platform}"
  url="https://github.com/${REPO}/releases/latest/download/${artifact}"

  mkdir -p "$INSTALL_DIR"
  echo "다운로드: $url"
  curl -fsSL "$url" -o "$INSTALL_DIR/claudetower"
  chmod +x "$INSTALL_DIR/claudetower"

  echo ""
  echo "설치 완료: $INSTALL_DIR/claudetower"
  echo "PATH에 추가하려면 셸 설정 파일(.bashrc/.zshrc 등)에 다음 줄을 추가하세요:"
  echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
  echo "그 다음 'claudetower setup'을 실행하세요."
}

main "$@"
