---
name: claudetower:status
description: ClaudeTower(상태표시줄 CLI)가 설치돼 있는지, 어떤 항목이 켜져 있는지 확인합니다.
allowed-tools: Bash(claudetower status:*)
---

# /claudetower:status

`claudetower status` 명령을 그대로 실행하고, 출력 결과를 사용자에게 보여준다. 별도 가공·요약 없이
원문을 그대로 전달한다(정확성 우선).

## 실행 결과가 실패한 경우(예: "command not found"류 오류 — PATH에 claudetower가 없다는 뜻)

명령을 재시도하지 말고, 아래 안내를 그대로 보여준 뒤 멈춘다:

> ClaudeTower CLI가 아직 설치돼 있지 않은 것 같습니다. 이 플러그인은 CLI를 호출만 할 뿐,
> CLI 자체를 대신 설치하지는 않습니다 — 먼저 아래 중 하나로 설치해주세요.
>
> - Windows(PowerShell): `irm https://raw.githubusercontent.com/sodam-ai/ClaudeTower/main/install.ps1 | iex`
> - macOS/Linux: `curl -fsSL https://raw.githubusercontent.com/sodam-ai/ClaudeTower/main/install.sh | sh`
>
> 설치 후 **새 터미널(또는 새 Claude Code 세션)**에서 이 명령을 다시 시도해주세요(같은 세션에서는
> 방금 등록된 PATH가 아직 반영되지 않을 수 있습니다).
