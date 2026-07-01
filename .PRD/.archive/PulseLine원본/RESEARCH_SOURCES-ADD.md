# RESEARCH_SOURCES

아래는 **Claude Code, Codex 등 AI 코딩 도구에서 설치/사용/적용 가능한 상태 표시줄 플러그인·Statusline·Status Bar 관련 사이트/주소/자료/문서**를 정리한 목록입니다.

먼저 핵심만 말하면, **Claude Code는 공식적으로 커스텀 상태 표시줄을 지원**합니다. `/statusline` 또는 `settings.json`의 `statusLine` 설정으로 shell script를 실행하고, Claude Code가 세션 정보를 JSON으로 stdin에 넘기면 script 출력이 상태 표시줄에 표시되는 구조입니다. 반면 **Codex CLI는 공식 config의 `[tui].status_line`으로 기본 항목 배열은 설정 가능하지만, Claude Code처럼 임의 script/플러그인 기반 커스텀 상태줄은 아직 제한적**이며 GitHub 이슈에서 커스텀 statusline 기능 요청이 계속 올라오고 있습니다. ([Claude](https://code.claude.com/docs/ko/statusline?utm_source=chatgpt.com))

## 1. Claude Code 공식 상태 표시줄 문서

```text
https://code.claude.com/docs/ko/statusline
https://code.claude.com/docs/en/statusline
https://code.claude.com/docs/zh-TW/statusline
https://code.claude.com/docs/pt/statusline
https://code.claude.com/docs/it/statusline
```

Claude Code 공식 statusline 문서는 context window 사용량, 세션 비용, 여러 세션 구분, git branch/status 등을 표시하는 용도로 statusline을 설명합니다. 또한 데이터가 Claude Code에서 script로 어떻게 전달되는지, 표시 가능한 필드, git 상태·비용 추적·진행률 표시줄 예제를 제공합니다. ([Claude](https://code.claude.com/docs/ko/statusline?utm_source=chatgpt.com))

## 2. Claude Code 플러그인 / 마켓플레이스 공식 문서

```text
https://code.claude.com/docs/en/plugins-reference
https://code.claude.com/docs/en/discover-plugins
https://code.claude.com/docs/en/plugin-marketplaces
https://github.com/anthropics/claude-code
https://github.com/anthropics/claude-plugins-official
```

Claude Code plugin은 skills, agents, hooks, MCP servers, LSP servers, monitors 등을 묶는 확장 구조입니다. 상태 표시줄 자체는 공식 `statusLine` 설정으로 동작하지만, Claude Code plugin marketplace를 통해 설치형 statusline 도구를 배포하는 방식도 가능합니다. ([Claude](https://code.claude.com/docs/en/plugins-reference?utm_source=chatgpt.com))

## 3. Claude Code 상태 표시줄 플러그인 / 도구 — 최우선 후보

```text
https://github.com/sirmalloc/ccstatusline
https://www.claudelog.com/claude-code-mcps/ccstatusline/

https://github.com/chongdashu/cc-statusline

https://github.com/fredrikaverpil/claudeline

https://github.com/AwesomeJun/awesome-claude-plugins
https://github.com/AwesomeJun/awesome-claude-plugins/blob/main/README.ko.md

https://github.com/Haleclipse/CCometixLine

https://github.com/tmck-code/yet-another-statusline
```

`ccstatusline`은 Claude Code CLI용으로 만든 커스터마이징 가능한 statusline이며 powerline, themes, real-time metrics를 내세우고 GitHub 공개 지표도 큽니다. `cc-statusline`은 현재 디렉토리, git branch, Claude model/version, context usage, cost tracking, session timer를 표시합니다. `claudeline`은 Claude Code plugin 방식 설치를 지원하며 `/plugin marketplace add fredrikaverpil/claudeline`, `/plugin install claudeline@claudeline`, `/claudeline:setup` 흐름을 안내합니다. ([GitHub](https://github.com/sirmalloc/ccstatusline?utm_source=chatgpt.com))

## 4. Claude Code 상태 표시줄 Skill / 마켓플레이스형 자료

```text
https://claudemarketplaces.com/plugins/setouchi-h-cc-marketplace/statusline
https://mcpmarket.com/tools/skills/statusline-customization
https://github.com/AwesomeJun/awesome-claude-plugins
https://crossaitools.com/
```

Claude Marketplace 쪽에는 branch, model, cost, duration, diff lines 등을 보여주는 `statusline` 플러그인이 있고, MCPMarket에는 token usage, session costs, Git branches, plan limits를 추적하는 statusline customization skill이 등록되어 있습니다. 다만 마켓플레이스형 자료는 설치 스크립트와 GitHub 원본을 확인한 뒤 쓰는 게 안전합니다. ([claudemarketplaces.com](https://claudemarketplaces.com/plugins/setouchi-h-cc-marketplace/statusline?utm_source=chatgpt.com))

## 5. Codex CLI 상태 표시줄 / TUI 공식 설정

```text
https://developers.openai.com/codex/config-advanced
https://developers.openai.com/codex/config-reference
https://developers.openai.com/codex/config-sample
https://github.com/openai/codex
https://developers.openai.com/codex/app
https://developers.openai.com/codex/cloud
```

Codex는 공식 sample config에서 `[tui].status_line`을 통해 footer status-line item ID를 배열로 지정할 수 있습니다. 기본값은 `model-with-reasoning`, `context-remaining`, `current-dir`이고, 예시로 `model`, `context-remaining`, `git-branch`를 지정할 수 있습니다. 다만 Claude Code처럼 command-backed shell script를 상태줄로 실행하는 구조는 공식 문서 기준으로는 제한적입니다. ([OpenAI 개발자](https://developers.openai.com/codex/config-advanced?utm_source=chatgpt.com))

## 6. Codex 커스텀 Statusline 관련 이슈 / 진행 상황 확인용

```text
https://github.com/openai/codex/issues/16921
https://github.com/openai/codex/issues/17827
https://github.com/openai/codex/issues/20140
https://github.com/openai/codex/issues/20244
https://github.com/openai/codex/issues/24080
https://github.com/openai/codex/issues/9756
https://github.com/openai/codex/issues/13660
```

Codex 쪽은 “Claude Code처럼 임의 script 기반 custom statusline을 지원해 달라”는 요청이 여러 번 올라와 있습니다. 특히 이슈에서는 현재 `[tui].status_line`이 `model-with-reasoning`, `current-dir`, `git-branch`, context usage 같은 고정 항목은 지원하지만, 임의 static text, command-backed output, conditional formatting, ANSI colors, 추가 persistent line은 지원하지 않는다고 설명합니다. ([GitHub](https://github.com/openai/codex/issues/17827?utm_source=chatgpt.com))

## 7. Codex / Claude / Cursor / Gemini 사용량 표시용 메뉴바·상태바 도구

```text
https://github.com/steipete/codexbar
https://github.com/ryoppippi/ccusage
https://ccusage.com/
```

`CodexBar`는 macOS 메뉴바에서 Codex, Claude, Cursor, Gemini, Copilot 등 여러 AI coding provider의 사용량·한도·reset window를 보여주는 도구입니다. `ccusage`는 Claude Code 사용량 분석 CLI로 시작했지만 현재는 Codex, OpenCode, Amp, Droid, Hermes Agent, GitHub Copilot CLI, Gemini CLI 등 여러 CLI 사용량 리포트를 지원합니다. 상태줄 script에서 비용·토큰·세션 정보를 가져올 때 `ccusage`를 함께 쓰는 경우가 많습니다. ([GitHub](https://github.com/steipete/codexbar?utm_source=chatgpt.com))

## 8. Claude Code Statusline 제작 가이드 / 예제 글

```text
https://gordonbeeming.com/blog/2026-03-22/building-a-custom-claude-code-status-line
https://dslyh01.tistory.com/81
https://zenn.dev/makotan/articles/db34bb6860cda5
https://medium.com/@joe.njenga/i-found-this-claude-code-statusline-that-makes-my-terminal-magically-beautiful-2413fa8effe7
https://gist.github.com/panicoenlaxbox/826f0c5af67ebd06771afbbc9fad4733
```

커스텀 statusline을 직접 만들려면 Claude Code 공식 문서와 함께 Gordon Beeming의 글이 실전적으로 좋습니다. 해당 글은 `~/.claude/settings.json`에 `statusLine`을 추가하고 shell script를 연결하면, Claude가 JSON blob을 stdin으로 넘기고 stdout이 statusline이 된다고 설명합니다. ([xylem | Gordon Beeming](https://gordonbeeming.com/blog/2026-03-22/building-a-custom-claude-code-status-line?utm_source=chatgpt.com))

## 9. VS Code / IDE Status Bar 관련 이슈

```text
https://github.com/anthropics/claude-code/issues/21265
https://github.com/anthropics/claude-code/issues/23994
https://github.com/github/copilot-cli/issues/1311
```

Claude Code CLI statusline은 공식 지원되지만, VS Code 확장 안의 status bar/status line은 별도 이슈로 논의되고 있습니다. VS Code 패널 상단/하단 또는 VS Code native status bar item으로 표시하는 제안이 올라와 있고, Windows VS Code 환경에서 statusLine command가 실행되지 않는 사례도 보고되어 있습니다. ([GitHub](https://github.com/anthropics/claude-code/issues/21265?utm_source=chatgpt.com))

## 10. OpenCode / 다른 AI CLI 상태줄 참고용

```text
https://github.com/anomalyco/opencode/issues/8619
https://github.com/Dicklesworthstone/frankentui/blob/main/crates/ftui-widgets/src/status_line.rs
https://docs.rs/status-line
```

OpenCode 쪽에서도 Claude Code statusline처럼 plugin-driven statusLine hook을 추가하자는 이슈가 있습니다. AI CLI 전반이 model, cwd, git, context usage, cost, task progress를 상태줄에 표시하는 방향으로 수렴하고 있어서 참고용으로 볼 만합니다. ([GitHub](https://github.com/anomalyco/opencode/issues/8619?utm_source=chatgpt.com))

## 11. 조건부 / 주의해서 볼 자료

```text
https://github.com/b-open-io/statusline
https://github.com/AmedeeBulle/StatusLine
https://www.reddit.com/r/ClaudeAI/comments/1n5fafc/built_with_claude_contest_entry_ccstatusline_how/
https://www.threads.com/@codewithbeto/post/DW9TG1ojrHK/claude-code-pro-tip-show-useful-info-in-the-status-bar-by-running-statusline
```

`b-open-io/statusline`처럼 fork 또는 유사 프로젝트는 원본 `sirmalloc/ccstatusline`과 비교해서 업데이트·릴리스·설치 스크립트를 확인해야 합니다. Reddit, Threads, Medium 글은 실사용 팁은 빠르지만 공식 문서가 아니므로, 설치 명령을 그대로 붙여넣기 전에 GitHub README와 코드 내용을 확인하는 게 안전합니다. ([GitHub](https://github.com/b-open-io/statusline?utm_source=chatgpt.com))

## 최종 추천만 압축

```text
https://code.claude.com/docs/ko/statusline
https://code.claude.com/docs/en/statusline
https://code.claude.com/docs/en/plugins-reference
https://github.com/sirmalloc/ccstatusline
https://github.com/chongdashu/cc-statusline
https://github.com/fredrikaverpil/claudeline
https://github.com/AwesomeJun/awesome-claude-plugins
https://github.com/Haleclipse/CCometixLine
https://github.com/ryoppippi/ccusage
https://ccusage.com/
https://github.com/steipete/codexbar
https://developers.openai.com/codex/config-advanced
https://developers.openai.com/codex/config-sample
https://github.com/openai/codex/issues/20244
https://github.com/openai/codex/issues/16921
```

## 용도별로 보면 이렇게 보면 됩니다

```text
Claude Code 공식 상태표시줄:
https://code.claude.com/docs/ko/statusline

Claude Code 플러그인 구조:
https://code.claude.com/docs/en/plugins-reference

가장 인기 많은 Claude Code statusline:
https://github.com/sirmalloc/ccstatusline

가볍고 실용적인 Claude Code statusline:
https://github.com/chongdashu/cc-statusline

플러그인 설치형 Claude Code statusline:
https://github.com/fredrikaverpil/claudeline

한국어 README 포함 statusline:
https://github.com/AwesomeJun/awesome-claude-plugins/blob/main/README.ko.md

Rust 기반 고성능 statusline:
https://github.com/Haleclipse/CCometixLine

사용량/비용 추적:
https://github.com/ryoppippi/ccusage
https://ccusage.com/

macOS 메뉴바 사용량 표시:
https://github.com/steipete/codexbar

Codex 공식 TUI status_line 설정:
https://developers.openai.com/codex/config-sample

Codex 커스텀 statusline 요청:
https://github.com/openai/codex/issues/20244
```

## 바로 선택하면

```text
1순위: Claude Code에서 예쁘고 강력한 상태줄
https://github.com/sirmalloc/ccstatusline

2순위: Claude Code에서 설치형 플러그인 방식
https://github.com/fredrikaverpil/claudeline

3순위: Claude Code에서 간단한 정보 표시
https://github.com/chongdashu/cc-statusline

4순위: Claude/Codex/Gemini 등 사용량 모니터링
https://github.com/ryoppippi/ccusage
https://github.com/steipete/codexbar

5순위: Codex 기본 상태줄 설정
https://developers.openai.com/codex/config-sample
```

## 검증 요약

1. **웹 검색 반영**: Claude Code statusline, Codex status_line, GitHub 플러그인, 사용량 도구, 이슈까지 검색 기준으로 정리했습니다.
2. **이전 대화 흐름 반영**: Prompt / Context / Loop / Harness / Agentic / Reverse Engineering 흐름처럼 공식 문서, GitHub, 설치형 자료, 조건부 자료로 나눴습니다.
3. **Claude Code 적용성 확인**: 공식 statusline 문서, plugin reference, plugin marketplace 설치형 도구를 포함했습니다.
4. **Codex 적용성 확인**: Codex 공식 `[tui].status_line` 설정 문서와 커스텀 statusline 요청 이슈를 분리했습니다.
5. **설치 가능한 자료 포함**: `ccstatusline`, `cc-statusline`, `claudeline`, `Awesome Statusline`, `CCometixLine`을 포함했습니다.
6. **사용량/비용 표시 도구 포함**: `ccusage`, `CodexBar`를 포함했습니다.
7. **공식/비공식 구분**: Claude Code 공식 기능과 커뮤니티 플러그인을 분리했습니다.
8. **주의점 반영**: Codex는 아직 Claude Code식 command-backed custom statusline이 제한적이라는 점을 명확히 분리했습니다.
9. **조건부 자료 분리**: fork, Reddit, Threads, Medium, 비공식 마켓 자료는 조건부 참고로 분리했습니다.
10. **복사 편의성 반영**: 요청하신 방식대로 URL을 카테고리별 코드블럭으로 정리했습니다.
