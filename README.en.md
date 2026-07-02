# ClaudeTower (working title)

[한국어](./README.md) | [English](./README.en.md)

A statusline + (planned) multi-account switching CLI for Claude Code.

> **Current status (important)**: Only **Phase 1** is implemented so far. "① Statusline" below works right now. "② Account switching" **does not have any code yet** (it's not disabled — it simply hasn't been built). It's planned for Phase 2, gated behind an explicit user consent flow.

---

## ① Statusline (always safe, install and you're done)

Shows your current project path, context usage, cost, and rate limits at the bottom of the Claude Code screen. **It never touches your Claude account credentials or password.**

### Prerequisites

- [Node.js](https://nodejs.org) 22 or later — **needed right now because this is still in development. The final release (an SEA binary) is designed to run without Node.js installed at all.**
- The latest version of Claude Code
- Git (only if you're cloning the repo to build it yourself)

### Quick start (5 steps)

1. Clone the repository
   ```bash
   git clone https://github.com/sodam-ai/ClaudeTower.git
   cd ClaudeTower
   ```
2. Install development tooling
   ```bash
   npm install
   ```
3. Build the distributable executable
   ```bash
   npm run build
   ```
   This produces one executable in `dist/` matching your OS (e.g. `claudetower-win-x64.exe`).
4. Register the statusline
   ```bash
   node bin/claudetower.js setup
   ```
   Answer Y or N to each question (location/context/cost/rate-limit) and you're done.
5. The statusline appears starting from your next Claude Code interaction — no restart needed.

> Official distribution channels (a one-line `curl`/`PowerShell` install, or `npm install -g`) are still being prepared — see "Installation" below for why.

### Installation (current status per channel)

| Method | Status | Notes |
|---|---|---|
| Build from source (5 steps above) | ✅ Works now | For developers, requires Node.js |
| `curl`/`PowerShell` one-liner (`install.sh`/`install.ps1`) | ⏳ Scripts are done, **waiting on a GitHub Release** | No Node.js required; will be the easiest path once ready |
| `npm install -g` | ❌ Currently broken for this private repo (known issue) | Will be re-verified once the repo goes public |

### Commands (only what actually exists right now)

- `claudetower --version` / `--help`
- `claudetower setup` — pick which statusline widgets to show + auto-register with Claude Code
- `claudetower statusline` — the renderer Claude Code invokes internally (you won't run this by hand)

> Account-related commands like `accounts` or `config` **do not exist yet** (planned for Phase 2).

### Security & data flow

- Nothing is ever sent externally. Everything runs locally on your machine.
- Each time Claude Code hands the statusline program your current state (project path, context usage, etc.), it's only rendered on screen — never stored.

### Architecture (in plain terms)

This program is split into two completely separate rooms. The "statusline room" only displays information on screen, so it's always safe. The "account-switching room" hasn't even been built yet — and when it is, its key won't open the statusline room's door. Automated checks (ESLint) and tests verify on every change that no secret door has snuck in between the two rooms.

---

## ② Account switching (planned for Phase 2, doesn't exist yet)

**No code for this feature exists yet.** Once built, it will require an explicit consent step with the warning "This feature carries a risk that your Claude account could be suspended. The statusline works fine without turning this on" before it can ever be enabled (see [`.PRD/01_PRD.md`](./.PRD/01_PRD.md) for the full design).

---

## Troubleshooting

- **The statusline doesn't show up**: Try one more Claude Code interaction — settings don't apply instantly, only from the next interaction onward.
- **`npm run build` fails**: Check that `node --version` is 22 or later.
- **Windows shows a warning when running the built executable**: It isn't code-signed yet, so Windows may show an "unknown publisher" warning. Click "More info" then "Run anyway" — this is expected before an official signed release.
- **The context percentage looks off**: It can be empty early in a session or right after `/compact` — that's expected, official Claude Code behavior.

## FAQ

- **Does installing this automatically collect my account info?** No. Account-related code isn't included in this version at all.
- **Does anything get sent over the internet?** No, everything runs locally only.
- **Will account switching turn on automatically once it's built?** No. It's designed to require your explicit consent before it can ever be enabled.

## Legal, copyright, and license

- License: MIT (copyright holder not finalized yet — see [`LICENSE`](./LICENSE))
- This project is for personal use; there are no plans for commercial sale or a paid service.
- For more background, see the "법률·저작권·라이선스·상업적 사용 요구사항" section in [`.PRD/04_PROJECT_SPEC.md`](./.PRD/04_PROJECT_SPEC.md).

## Full design documentation

The design rationale, decision history, and security requirements for this project are all in the [`.PRD/`](./.PRD/) folder.
