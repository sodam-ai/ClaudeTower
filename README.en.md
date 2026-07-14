# ClaudeTower (working title)

[한국어](./README.md) | [English](./README.en.md)

A statusline CLI for Claude Code. (The account auto-switching feature was reviewed and will not be built, for legal reasons — see "② Account switching" below.)

> 📖 **New to computers or AI tools?** We've prepared a much more detailed, beginner-friendly [Complete User Guide (GUIDE.en.md)](./GUIDE.en.md).

> **Current status (important)**: This project provides the statusline (Display) feature only (current released version: v0.1.10). "① Statusline" below works right now. "② Account switching" **will not be built** — after reading Anthropic's official Terms of Service directly, we confirmed there is no way to implement this feature safely, so we decided not to build it (confirmed 2026-07-15; see "② Account switching" below for details).

---

## Table of Contents

- [① Statusline](#①-statusline-always-safe-install-and-youre-done)
  - [Quick start (5 steps)](#quick-start--download-and-run-for-everyone-5-steps)
  - [Installation](#installation-current-status-per-channel)
  - [Command list](#commands-only-what-actually-exists-right-now)
  - [Chat-based toggling](#turn-widgets-onoff-right-from-the-claude-code-chat--no-terminal-needed)
  - [Building from source](#for-developers--building-from-source)
  - [Security & data flow](#security--data-flow)
  - [Architecture](#architecture-in-plain-terms)
- [② Account switching (decided not to build)](#②-account-switching-decided-not-to-build)
- [Version history summary](#version-history-summary)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Legal, copyright, and license](#legal-copyright-and-license)
- [Full design documentation](#full-design-documentation)

> 📖 For a much more detailed, beginner-friendly walkthrough (prerequisites, step-by-step screenshots-level detail, workflow diagrams, full FAQ), see the [Complete User Guide (GUIDE.en.md)](./GUIDE.en.md).

---

## ① Statusline (always safe, install and you're done)

Shows your current project path, active model, context usage, cost, and rate limits at the bottom of the Claude Code screen, with colored gauge bars. **It never touches your Claude account credentials or password.**

Example:
```
Sonnet 5  📁 my-project  컨텍스트 ██░░░ 45%  💰 $1.50  5시간 ████░ 78%·1:41  7일 ███░░ 71%·일06:00
```
(The reset countdown is always shown alongside the percentage, regardless of usage level.)

### Quick start — download and run (for everyone, 5 steps)

**You don't need to install Node.js.** Just follow the steps below.

1. Grab the file for your OS from the [Releases page](https://github.com/sodam-ai/ClaudeTower/releases/latest).
   - Windows → `claudetower-win-x64.exe`
   - macOS (Apple Silicon) → `claudetower-macos-arm64`
   - Linux (x64) → `claudetower-linux-x64`
2. Put the file in any folder you like. You can rename it or move it to another folder later — that's fine (see "Can I delete or move the installed file?" below).
3. Open a terminal in that folder (on Windows: type `cmd` in File Explorer's address bar and press Enter).
4. Run:
   ```
   claudetower-win-x64.exe setup
   ```
   (On macOS/Linux, prefix with `./`: `./claudetower-macos-arm64 setup`)
   Answer Y or N to each question (model/location/context/cost/rate-limit) and you're done. The executable automatically copies itself to a fixed, safe location on your computer (`~/.claudetower/bin/`) as part of this step. (On Windows, one more question follows — "make claudetower work as a short command in the terminal?" — either answer works fine; the statusline itself behaves identically.)
5. The statusline appears starting from your next Claude Code interaction — no restart needed.

### Installation (current status per channel)

| Method | Status | Notes |
|---|---|---|
| **Download directly from GitHub Releases** (5 steps above) | ✅ Works now | No Node.js required |
| `curl`/`PowerShell` one-liner (`install.sh`/`install.ps1`) | ✅ Works now (fixed 2026-07-04 — a `main` branch now exists) | No Node.js required, see commands below |
| Build from source | ✅ Works now | For developers, requires Node.js 22+ — see "For developers" below |
| `npm install -g` | ⏸️ Deliberately deferred | "ClaudeTower/claudetower" is still a working title, and trademark clearance is unresolved (`.PRD/01_PRD.md` §7, `[legal review needed]`). An npm package name is effectively permanent once claimed, so we won't publish until the name is final |

macOS/Linux:
```bash
curl -fsSL https://raw.githubusercontent.com/sodam-ai/ClaudeTower/main/install.sh | sh
```
Windows (PowerShell):
```powershell
irm https://raw.githubusercontent.com/sodam-ai/ClaudeTower/main/install.ps1 | iex
```

### Can I delete or move the installed file?

**Yes.** The first time you run `setup`, the executable automatically copies itself to a fixed location on your computer (`~/.claudetower/bin/`) and settles there safely. After that, you're free to delete, rename, or move the file you originally downloaded — it no longer matters.

If you accidentally delete that fixed-location copy too and the statusline stops showing up, just run `claudetower setup` again — it repairs itself automatically.

### Commands (only what actually exists right now)

> **Note**: The 5 steps above are already the complete statusline setup. The commands below are only for later, optional tweaks. If you answered Y to "make `claudetower` work as a short command in the terminal?" during `setup`, bare `claudetower` already works in new terminals; if you answered N (or installed an older version), it may not yet. So:
> - **Easiest (no terminal needed)**: in the Claude Code chat, type `/claudetower-widgets` or just say something like "turn off the cost widget".
> - If you still want to type it in a terminal, use the full path instead of bare `claudetower`: `~/.claudetower/bin/claudetower.exe` (macOS/Linux: `~/.claudetower/bin/claudetower`).

- `claudetower --version` / `--help`
- `claudetower setup` — pick which statusline widgets to show + auto-register with Claude Code (includes the self-install step above)
- `claudetower status` — check whether it's currently installed and which widgets are enabled
  ```
  Install status: installed (claudetower's statusline is registered with Claude Code)
  Widgets shown: model, project location, context usage, cost, rate limits (5h/7d)
  ```
- `claudetower widgets` — check which widgets are currently on
- `claudetower widgets off <widgets...>` / `claudetower widgets on <widgets...>` — turn only the named widgets on/off (everything else stays as-is — no need to re-answer all 5 `setup` questions). Widget names: `model`, `location`, `context`, `cost`, `rate_limit`
- `claudetower config statusline-refresh <seconds>` — adjusts how often the statusline refreshes (default 3s; if you keep several sessions open at once, raising it to 5s or more reduces load on your computer further). This value is kept even if you run `setup` again. You can also just say "slow down the statusline refresh" in the Claude Code chat instead of using a terminal
- `claudetower uninstall` — safely removes only the statusline registration (leaves your other Claude Code settings untouched)
- `claudetower statusline` — the renderer Claude Code invokes internally (you won't run this by hand)

### Turn widgets on/off right from the Claude Code chat — no terminal needed

Running `setup` also installs a conversational command, `/claudetower-widgets`. Type `/claudetower-widgets` in the Claude Code chat, or just say something like "turn off context and cost in the statusline" or "slow down the refresh rate," and the AI shows you the current state and toggles it (or adjusts the speed) for you — no terminal, no command syntax to remember. If you just type `/claudetower-widgets` with nothing after it, a check-box menu pops up so you can tick what to change (only the ticked items change — anything left unticked stays as-is).

> Account-related commands like `accounts` **do not exist** (the account-switching feature has been decided against — see "② Account switching" below).

### Changing which widgets are shown later

Just run `claudetower setup` again. Answer `Y` for what you want on and `n` for what you want off — there's no separate "settings" command, `setup` doubles as that.

### For developers — building from source

```bash
git clone https://github.com/sodam-ai/ClaudeTower.git
cd ClaudeTower
npm install
npm run build
```
This produces one executable in `dist/` matching your OS. Run `npm run verify` afterward to check lint, module boundaries, and tests in one go.

### Security & data flow

- Nothing is ever sent externally. Everything runs locally on your machine.
- Each time Claude Code hands the statusline program your current state (project path, context usage, etc.), it's only rendered on screen — never stored.

### Architecture (in plain terms)

This program was designed from the start with the "statusline" part and the "account-switching" part completely separated. The "statusline room" only displays information on screen, so it's always safe. The "account-switching room" was only ever a design sketch — it was never actually built, and for the reasons explained below, it has now been decided that it never will be.

---

## ② Account switching (decided not to build)

Originally, this project planned to add a feature that would let you automatically switch between multiple Claude accounts. On 2026-07-15, after reading Anthropic's official Terms of Service directly, we confirmed there is no safe way to build this feature.

- Anthropic explicitly prohibits third-party tools from logging in with subscription (Free/Pro/Max) credentials and using that account on a user's behalf. As of 2026-01-09, this is also technically blocked server-side — confirmed by multiple independent news sources.
- Separately, using automated scripts to access the service through anything other than an API key is also prohibited on its own. So even a workaround that avoids handling login credentials directly (e.g., leaving login to Claude Code itself and only automating which config folder is active) would still run into this rule.

In short, there was no way to build the original goal — automatically cycling through multiple subscription accounts — without breaking the rules. So we have **decided not to build this feature**, with no plans to revisit it later. The statusline feature keeps working normally regardless of this decision.

---

## Version history summary

Officially released versions (current latest: v0.1.10). Click to expand. **For the full history and detailed notes, see [GUIDE.en.md, section 11](./GUIDE.en.md#11-version-history-summary).**

<details>
<summary><strong>v0.1.10</strong> — Percentage display fix, one-liner install stabilized (latest)</summary>

Fixed impossible out-of-range percentage displays. Stabilized the curl/PowerShell one-liner install. Added an "not an official Anthropic product" disclaimer.
</details>

<details>
<summary><strong>v0.1.9</strong> — Quick widget toggle + chat-based setup</summary>

Added `claudetower widgets on/off`. Auto-installs the `/claudetower-widgets` chat command.
</details>

<details>
<summary><strong>v0.1.0 – v0.1.8</strong> — Early development</summary>

From the initial release through gauge bars, the double-click fix, `uninstall`/`status` commands, reset-time display, and install reliability improvements — see GUIDE.en.md for full details.
</details>

> **Note (unreleased, in development)**: `config statusline-refresh` (adjustable refresh speed), a new 3-second default refresh speed for fresh installs, the PATH registration prompt, and the skill-file self-healing fix, and the `/claudetower-widgets` check-box menu already exist in code but haven't shipped in a numbered release yet. As of 2026-07-11, two more fixes exist in code but likewise haven't shipped: the five-hour/seven-day reset time no longer shows an unrealistically far-future value, and an overly long model name or folder name no longer breaks the statusline display. **As of 2026-07-12, a fix also landed for the cost widget so a corrupted negative value no longer displays a nonsensical number like "$-5.00"** (clamped so it never drops below zero). See GUIDE.en.md section 11 for details.

## Troubleshooting

- **The statusline doesn't show up**: Try one more Claude Code interaction — settings don't apply instantly, only from the next interaction onward.
- **`/claudetower-widgets` (chat-based toggle) suddenly stops working**: Root cause confirmed — this program's own automated verification routine had a bug that could delete the real config files by mistake (not something you did). A guard against recurrence and a self-healing fix (recreates it within seconds if it ever goes missing) have both been applied, pending the next release. If you hit this on the current version, run `claudetower setup` once more to fix it immediately.
- **`claudetower status` says "registered but the executable can't be found (broken)"**: You've deleted or moved the file that was installed. Run `claudetower setup` again to repair it automatically.
- **Double-clicking the exe opens a window that closes immediately**: Running it with no arguments just shows help text and exits. To actually use it, open a terminal and type a command directly, e.g. `claudetower-win-x64.exe setup`.
- **`npm run build` fails (for developers)**: Check that `node --version` is 22 or later.
- **Windows shows a warning when running the executable**: It isn't code-signed yet, so Windows may show an "unknown publisher" warning. Click "More info" then "Run anyway" — this is expected before an official signed release.
- **The context percentage looks off**: It can be empty early in a session or right after `/compact` — that's expected, official Claude Code behavior.

## FAQ

- **Does installing this automatically collect my account info?** No. Account-related code isn't included in this version at all.
- **Does anything get sent over the internet?** No, everything runs locally only.
- **Are there plans to build account switching?** No. After review, we decided not to build it due to legal concerns (see "② Account switching" above for details).
- **Is it really okay to delete the file I originally downloaded?** Yes, as long as you've run `setup` at least once first — see "Can I delete or move the installed file?" above.

## Legal, copyright, and license

- **This program is not an official Anthropic product.** It's an unofficial companion tool built by an individual, with no affiliation or sponsorship from Anthropic.
- License: Apache License 2.0 (copyright holder: SoDam AI Studio — see [`LICENSE`](./LICENSE))
- This project is for personal use; there are no plans for commercial sale or a paid service.
- For more background, see the "법률·저작권·라이선스·상업적 사용 요구사항" section in [`.PRD/04_PROJECT_SPEC.md`](./.PRD/04_PROJECT_SPEC.md).

## Full design documentation

The design rationale, decision history, and security requirements for this project are all in the [`.PRD/`](./.PRD/) folder.
