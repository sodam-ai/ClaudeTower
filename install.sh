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
  local platform artifact url native_artifact native_url
  platform="$(detect_platform)"
  artifact="claudetower-${platform}"
  url="https://github.com/${REPO}/releases/latest/download/${artifact}"

  mkdir -p "$INSTALL_DIR"
  echo "다운로드: $url"

  # .PRD/05_FIELD_ISSUES_2026-07-04.md 이슈#1(P0)과 동일한 근본 원인(실행 중인
  # 파일에 직접 다운로드)을 막기 위해 install.ps1과 동일하게 임시 경로로 받은
  # 뒤 원자적으로 교체한다. POSIX의 mv(rename)는 대상이 실행 중이어도 Windows처럼
  # 잠기지 않고 그대로 성공한다(이미 실행 중인 프로세스는 옛 inode를 계속 참조) —
  # 그래서 Windows판과 달리 재시도 루프는 필요 없다.
  local tmp_path="$INSTALL_DIR/claudetower.download.$$"
  curl -fsSL "$url" -o "$tmp_path"
  chmod +x "$tmp_path"
  mv -f "$tmp_path" "$INSTALL_DIR/claudetower"

  # 2026-08-20 결정: Account 기능(계정 등록·자동전환)은 Windows/macOS 전용으로 범위를
  # 좁혔다 — Linux 배포판은 애초에 이 네이티브 addon을 빌드하지 않는다(build-sea.js
  # SUPPORTS_ACCOUNT_KEYRING 참고). Linux에서는 이 다운로드를 건너뛴다 — 상태표시줄
  # (Display) 기능은 이 파일 없이도 완전히 정상 동작한다.
  if [ "$platform" != "linux-x64" ]; then
    # M38: credential-store(계정 등록 등)가 실제로 동작하려면 exe와 같은 폴더에 네이티브
    # addon(keyring-native.node)이 반드시 함께 있어야 한다(process.dlopen 우회 로딩,
    # src/accounts/credential-store/index.js 참고).
    native_artifact="keyring-native-${platform}.node"
    native_url="https://github.com/${REPO}/releases/latest/download/${native_artifact}"
    echo "다운로드: $native_url"
    local native_tmp_path="$INSTALL_DIR/keyring-native.node.download.$$"
    curl -fsSL "$native_url" -o "$native_tmp_path"
    mv -f "$native_tmp_path" "$INSTALL_DIR/keyring-native.node"
  else
    echo "(Linux는 계정 자동전환 기능을 지원하지 않아 관련 파일 다운로드를 건너뜁니다 — 상태표시줄 기능은 정상 설치됩니다.)"
  fi

  echo ""
  echo "설치 완료: $INSTALL_DIR/claudetower"
  echo "PATH에 추가하려면 셸 설정 파일(.bashrc/.zshrc 등)에 다음 줄을 추가하세요:"
  echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
  echo "그 다음 'claudetower setup'을 실행하세요."
}

main "$@"
