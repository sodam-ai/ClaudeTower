---
name: claudetower:widgets
description: ClaudeTower 상태표시줄 위젯(사용 모델·프로젝트 위치·Git·컨텍스트·비용·사용률·활성 계정)을 켜고 끕니다.
argument-hint: [on|off <항목...>]
allowed-tools: Bash(claudetower widgets:*), Bash($HOME/.claudetower/bin/claudetower widgets:*), Bash($HOME/.claudetower/bin/claudetower.exe widgets:*)
---

# /claudetower:widgets

사용자가 `$ARGUMENTS`를 함께 줬으면 `claudetower widgets $ARGUMENTS`를, 아무것도 안 줬으면
`claudetower widgets`(인자 없음 — 지금 상태만 보여줌, 아무것도 바꾸지 않음)를 그대로 실행하고
출력을 사용자에게 보여준다.

## "command not found"류 오류가 나면 — 재시도하지 말고 바로 고정 설치 경로로 1회만 다시 시도

`claudetower`가 PATH에 없다는 오류(command not found 등)가 나면, 곧바로 아래처럼 **고정 설치
위치의 실행파일을 직접 호출해서 딱 1번만** 다시 시도한다(이 경로는 `claudetower setup`이
항상 자기 자신을 설치해두는 고정 위치라 PATH 등록 상태와 무관하게 항상 유효하다):

- Windows: `"$HOME/.claudetower/bin/claudetower.exe" widgets $ARGUMENTS`
- macOS/Linux: `"$HOME/.claudetower/bin/claudetower" widgets $ARGUMENTS`

이 재시도도 실패하면(파일 자체가 없음) 그때 비로소 아래 "실행 결과가 실패한 경우" 안내로
넘어간다. 재시도는 이 1회만 — 그 이상 다른 경로를 추측해서 시도하지 말 것.

## 사용법 안내(사용자가 헷갈려 하면 이대로 알려줄 것)

- `/claudetower:widgets` — 지금 켜져 있는 항목만 확인(변경 없음)
- `/claudetower:widgets off 항목이름` — 지정한 항목만 끄기(나머지는 그대로 유지)
- `/claudetower:widgets on 항목이름` — 지정한 항목만 켜기
- 항목 이름: `model`, `location`, `git`, `context`, `cost`, `rate_limit`, `active_account`
- 여러 개 한 번에: `/claudetower:widgets off context cost`

## 실행 결과가 실패한 경우

- **"알 수 없는 항목"류 오류** — 사용자가 위 7개 목록에 없는 이름을 입력한 것이다. 목록을
  다시 보여주고 정확한 이름으로 재시도할지 물어본다(임의로 비슷한 이름을 추측해서 재시도하지 말 것).
- **"command not found"류 오류**(PATH에 claudetower가 없음) — 아래 안내를 보여주고 멈춘다:

> ClaudeTower CLI가 아직 설치돼 있지 않은 것 같습니다. 먼저 설치해주세요.
> - Windows(PowerShell): `irm https://raw.githubusercontent.com/sodam-ai/ClaudeTower/main/install.ps1 | iex`
> - macOS/Linux: `curl -fsSL https://raw.githubusercontent.com/sodam-ai/ClaudeTower/main/install.sh | sh`
>
> 설치 후 새 터미널(또는 새 Claude Code 세션)에서 다시 시도해주세요.
