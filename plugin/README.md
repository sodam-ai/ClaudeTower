# ClaudeTower — 마켓플레이스 래퍼

이 폴더는 ClaudeTower CLI를 Claude Code 마켓플레이스에서 찾아 설치할 수 있게 해주는
**얇은 래퍼**입니다. 여기 있는 슬래시 명령(`/claudetower:status`, `/claudetower:widgets`,
`/claudetower:config`)은 전부 이미 설치된 CLI(`claudetower`)를 그대로 호출만 합니다 —
새 로직은 없습니다. 핵심 기능·보안 설계는 전부 저장소 루트의 CLI 코드(`src/`, `bin/`)에 있고,
이 폴더는 그걸 Claude Code 채팅 안에서 더 쉽게 쓰게 해주는 발견성(discoverability) 보조
채널일 뿐입니다.

## 설치 순서

1. **CLI를 먼저 설치**(이 플러그인이 대신 설치해주지 않습니다):
   - Windows(PowerShell): `irm https://raw.githubusercontent.com/sodam-ai/ClaudeTower/main/install.ps1 | iex`
   - macOS/Linux: `curl -fsSL https://raw.githubusercontent.com/sodam-ai/ClaudeTower/main/install.sh | sh`
2. Claude Code 채팅에서:
   ```
   /plugin marketplace add sodam-ai/ClaudeTower
   /plugin install claudetower@claudetower-marketplace
   ```
3. 이제 `/claudetower:status`, `/claudetower:widgets`, `/claudetower:config` 슬래시 명령을
   쓸 수 있습니다.

## 왜 `/claudetower:setup`은 없나요

`claudetower setup`은 여러 질문에 하나씩 Y/n으로 답하는 대화형 명령입니다 — 슬래시 명령이
안전하게 흉내 내기엔 아직 검증이 더 필요해 이번 1차 버전에서는 뺐습니다. 지금은 터미널에서
`claudetower setup`을 직접 실행해주세요(설치 스크립트가 안내합니다).

## 저장소 소속

이 폴더는 [ClaudeTower 저장소](https://github.com/sodam-ai/ClaudeTower) 안에 있으며,
CLI와 버전을 함께 관리합니다(별도 저장소 아님).
