#!/usr/bin/env bash
# ClaudeTower 설치 스크립트 (macOS/Linux, curl -fsSL .../install.sh | sh)
#
# 주의: 이 저장소가 비공개(private)인 동안에는 GitHub Release 자산이
# 인증 없는 curl로 받아지지 않는다 — 저장소를 공개 전환하거나 GitHub Release
# 자체를 아직 만들지 않은 상태에서는 이 스크립트가 실제로 동작하지 않는다
# (Phase 1 시점에는 스크립트 구조만 완성, 실다운로드 검증은 보류 — .PRD 참고).
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
