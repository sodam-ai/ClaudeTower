---
name: claudetower:config
description: ClaudeTower 상태표시줄 갱신 주기·Powerline 구분자·좌우 여백을 조절합니다.
argument-hint: statusline-refresh <초> | powerline <on|off> | padding <n>
allowed-tools: Bash(claudetower config:*), Bash($HOME/.claudetower/bin/claudetower config:*), Bash($HOME/.claudetower/bin/claudetower.exe config:*)
---

# /claudetower:config

`$ARGUMENTS`가 비어 있으면 실행하지 말고, 아래 사용법을 먼저 보여준 뒤 무엇을 바꾸고 싶은지
물어본다. `$ARGUMENTS`가 있으면 `claudetower config $ARGUMENTS`를 그대로 실행하고 출력을
사용자에게 보여준다.

## 사용법

- `/claudetower:config statusline-refresh 5` — 상태표시줄 갱신 주기를 5초로(권장값, 기본 3초)
- `/claudetower:config powerline on` / `off` — 위젯 사이 구분자를 화살표로 바꾸기/원래대로
- `/claudetower:config padding 2` — 상태표시줄 좌우 여백(문자 수, 기본 0)

## 실행 결과가 실패한 경우

- **값 검증 오류**(예: "0 이상의 정수여야 합니다") — CLI가 이미 사람이 읽을 수 있는 오류
  메시지를 주므로 그대로 보여주면 된다. 임의로 값을 보정해서 재시도하지 말 것(사용자가 정확한
  값을 다시 입력하게 한다).
- **"command not found"류 오류**(PATH에 claudetower가 없음) — 곧바로 **고정 설치 위치의
  실행파일을 직접 호출해서 딱 1번만** 다시 시도한다(PATH 등록 상태와 무관하게 항상 유효한
  위치):
  - Windows: `"$HOME/.claudetower/bin/claudetower.exe" config $ARGUMENTS`
  - macOS/Linux: `"$HOME/.claudetower/bin/claudetower" config $ARGUMENTS`

  이 재시도도 실패하면(파일 자체가 없음) 아래 안내를 보여주고 멈춘다. 재시도는 이 1회만:

> ClaudeTower CLI가 아직 설치돼 있지 않은 것 같습니다. 먼저 설치해주세요.
> - Windows(PowerShell): `irm https://raw.githubusercontent.com/sodam-ai/ClaudeTower/main/install.ps1 | iex`
> - macOS/Linux: `curl -fsSL https://raw.githubusercontent.com/sodam-ai/ClaudeTower/main/install.sh | sh`
>
> 설치 후 새 터미널(또는 새 Claude Code 세션)에서 다시 시도해주세요.
