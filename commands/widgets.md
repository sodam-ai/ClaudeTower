---
name: claudetower:widgets
description: ClaudeTower 상태표시줄 위젯(사용 모델·프로젝트 위치·Git·컨텍스트·비용·사용률·활성 계정)을 켜고 끕니다.
argument-hint: [on|off <항목...>]
allowed-tools: Bash(claudetower widgets:*), Bash($HOME/.claudetower/bin/claudetower widgets:*), Bash($HOME/.claudetower/bin/claudetower.exe widgets:*)
---

# /claudetower:widgets

사용자가 `$ARGUMENTS`를 함께 줬으면 `claudetower widgets $ARGUMENTS`를 그대로 실행하고 출력을
보여준 뒤 끝낸다(스크립팅·숙련 사용자용 경로 — 바로 아래 메뉴로 넘어가지 않는다).

`$ARGUMENTS`가 없으면 아래 "인자 없이 호출됨 — 메뉴로 안내" 순서를 따른다.

## 인자 없이 호출됨 — 메뉴로 안내

1. `claudetower widgets`(인자 없음)를 실행해 지금 상태를 확인하고 그대로 보여준다.
2. 이어서 AskUserQuestion으로 "무엇을 켜고 끌까요?" 메뉴를 띄운다 — 7개 항목을 한 번에
   묻지 못하므로(질문당 옵션 최대 4개) 아래처럼 **2개 질문으로 나눠 한 번에** 묻는다. 각
   옵션은 multiSelect(여러 개 선택 가능)로 설정하고, 옵션 설명에 방금 1번에서 확인한
   현재 상태("현재: 켜짐" / "현재: 꺼짐")를 넣는다. **의미는 "상태를 바꾸고 싶은 항목"이다
   (켜기/끄기를 따로 묻지 않는다) — 켜짐 항목을 고르면 끄고, 꺼짐 항목을 고르면 켠다.**
   - 질문 A(header "위젯 A"): 사용 모델(`model`) · 프로젝트 위치(`location`) ·
     Git 브랜치/변경사항(`git`) · 컨텍스트 사용량(`context`)
   - 질문 B(header "위젯 B"): 비용(`cost`) · 사용률/5시간·7일(`rate_limit`) ·
     활성 계정(`active_account`)
3. 두 질문에서 고른 항목을 모두 모아, 각각 원래 상태의 반대로 뒤집는다 — 원래 켜짐이던
   항목은 `off` 목록에, 원래 꺼짐이던 항목은 `on` 목록에 넣는다.
4. `on` 목록이 하나라도 있으면 `claudetower widgets on <on 목록>`을, `off` 목록이 하나라도
   있으면 `claudetower widgets off <off 목록>`을 각각 한 번씩 실행한다(두 명령 모두 필요할
   수 있음). 아무것도 선택되지 않았으면 명령을 실행하지 않고 "변경 없음"으로 안내하고
   끝낸다.
5. 실행 후 `claudetower widgets`(인자 없음)를 다시 실행해 바뀐 최종 상태를 보여준다.

## "command not found"류 오류가 나면 — 재시도하지 말고 바로 고정 설치 경로로 1회만 다시 시도

`claudetower`가 PATH에 없다는 오류(command not found 등)가 나면, 곧바로 아래처럼 **고정 설치
위치의 실행파일을 직접 호출해서 딱 1번만** 다시 시도한다(이 경로는 `claudetower setup`이
항상 자기 자신을 설치해두는 고정 위치라 PATH 등록 상태와 무관하게 항상 유효하다):

- Windows: `"$HOME/.claudetower/bin/claudetower.exe" widgets $ARGUMENTS`
- macOS/Linux: `"$HOME/.claudetower/bin/claudetower" widgets $ARGUMENTS`

이 재시도도 실패하면(파일 자체가 없음) 그때 비로소 아래 "실행 결과가 실패한 경우" 안내로
넘어간다. 재시도는 이 1회만 — 그 이상 다른 경로를 추측해서 시도하지 말 것.

## 사용법 안내(사용자가 헷갈려 하면 이대로 알려줄 것)

- `/claudetower:widgets` — 지금 상태를 보여준 뒤 바로 켜고 끌 항목을 메뉴로 물어봄(위 "인자
  없이 호출됨" 순서 참고)
- `/claudetower:widgets off 항목이름` — 메뉴 없이 지정한 항목만 바로 끄기(나머지는 유지)
- `/claudetower:widgets on 항목이름` — 메뉴 없이 지정한 항목만 바로 켜기
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
