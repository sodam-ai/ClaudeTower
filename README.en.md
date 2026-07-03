# ClaudeTower (working title)

[한국어](./README.md) | [English](./README.en.md)

A statusline + (planned) multi-account switching CLI for Claude Code.

> 📖 **New to computers or AI tools?** We've prepared a much more detailed, beginner-friendly [Complete User Guide (GUIDE.en.md)](./GUIDE.en.md) · [View as PDF (GUIDE.en.pdf)](./GUIDE.en.pdf).

> **Current status (important)**: Only **Phase 1** is implemented so far (current version: v0.1.8). "① Statusline" below works right now. "② Account switching" **does not have any code yet** (it's not disabled — it simply hasn't been built). It's planned for Phase 2, gated behind an explicit user consent flow.

---

## ① Statusline (always safe, install and you're done)

Shows your current project path, active model, context usage, cost, and rate limits at the bottom of the Claude Code screen, with colored gauge bars. **It never touches your Claude account credentials or password.**

Example:
```
모델 Sonnet 5  📁 my-project  컨텍스트 ██░░░ 45%  💰 $1.50  5시간 ████░ 78%·1:41  7일 ███░░ 71%·일06:00
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
   Answer Y or N to each question (model/location/context/cost/rate-limit) and you're done. The executable automatically copies itself to a fixed, safe location on your computer (`~/.claudetower/bin/`) as part of this step.
5. The statusline appears starting from your next Claude Code interaction — no restart needed.

### Installation (current status per channel)

| Method | Status | Notes |
|---|---|---|
| **Download directly from GitHub Releases** (5 steps above) | ✅ Works now | No Node.js required |
| `curl`/`PowerShell` one-liner (`install.sh`/`install.ps1`) | ⚠️ The script logic itself (download → install to a fixed location) is confirmed working, **but there's no `main` branch yet, so the "one-line install" via `raw.githubusercontent.com/.../main/...` doesn't work yet** (404) | Will work as soon as a `main` branch exists (at official release time) |
| Build from source | ✅ Works now | For developers, requires Node.js 22+ — see "For developers" below |
| `npm install -g` | ⚠️ Known to be broken when the repo was private — not yet re-verified after going public | To be checked next |

> We've confirmed that `install.sh`/`install.ps1`'s core logic — fetching the executable from a GitHub Release and installing it to a fixed location — actually works. However, the repository doesn't have a `main` branch yet (everything so far lives on the `feat/phase1-mvp-skeleton` branch), so a one-line install like `curl .../main/install.sh | sh` doesn't work yet. For now, use "Download directly from GitHub Releases" above.

### Can I delete or move the installed file?

**Yes.** The first time you run `setup`, the executable automatically copies itself to a fixed location on your computer (`~/.claudetower/bin/`) and settles there safely. After that, you're free to delete, rename, or move the file you originally downloaded — it no longer matters.

If you accidentally delete that fixed-location copy too and the statusline stops showing up, just run `claudetower setup` again — it repairs itself automatically.

### Commands (only what actually exists right now)

- `claudetower --version` / `--help`
- `claudetower setup` — pick which statusline widgets to show + auto-register with Claude Code (includes the self-install step above)
- `claudetower status` — check whether it's currently installed and which widgets are enabled
  ```
  Install status: installed (claudetower's statusline is registered with Claude Code)
  Widgets shown: model, project location, context usage, cost, rate limits (5h/7d)
  ```
- `claudetower uninstall` — safely removes only the statusline registration (leaves your other Claude Code settings untouched)
- `claudetower statusline` — the renderer Claude Code invokes internally (you won't run this by hand)

> Account-related commands like `accounts` or `config` **do not exist yet** (planned for Phase 2).

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

This program is split into two completely separate rooms. The "statusline room" only displays information on screen, so it's always safe. The "account-switching room" hasn't even been built yet — and when it is, its key won't open the statusline room's door. Automated checks (ESLint) and tests verify on every change that no secret door has snuck in between the two rooms.

---

## ② Account switching (planned for Phase 2, doesn't exist yet)

**No code for this feature exists yet.** Once built, it will require an explicit consent step with the warning "This feature carries a risk that your Claude account could be suspended. The statusline works fine without turning this on" before it can ever be enabled (see [`.PRD/01_PRD.md`](./.PRD/01_PRD.md) for the full design).

---

## Troubleshooting

- **The statusline doesn't show up**: Try one more Claude Code interaction — settings don't apply instantly, only from the next interaction onward.
- **`claudetower status` says "registered but the executable can't be found (broken)"**: You've deleted or moved the file that was installed. Run `claudetower setup` again to repair it automatically.
- **Double-clicking the exe opens a window that closes immediately**: Running it with no arguments just shows help text and exits. To actually use it, open a terminal and type a command directly, e.g. `claudetower-win-x64.exe setup`.
- **`npm run build` fails (for developers)**: Check that `node --version` is 22 or later.
- **Windows shows a warning when running the executable**: It isn't code-signed yet, so Windows may show an "unknown publisher" warning. Click "More info" then "Run anyway" — this is expected before an official signed release.
- **The context percentage looks off**: It can be empty early in a session or right after `/compact` — that's expected, official Claude Code behavior.

## FAQ

- **Does installing this automatically collect my account info?** No. Account-related code isn't included in this version at all.
- **Does anything get sent over the internet?** No, everything runs locally only.
- **Will account switching turn on automatically once it's built?** No. It's designed to require your explicit consent before it can ever be enabled.
- **Is it really okay to delete the file I originally downloaded?** Yes, as long as you've run `setup` at least once first — see "Can I delete or move the installed file?" above.

## Legal, copyright, and license

- License: MIT (copyright holder not finalized yet — see [`LICENSE`](./LICENSE))
- This project is for personal use; there are no plans for commercial sale or a paid service.
- For more background, see the "법률·저작권·라이선스·상업적 사용 요구사항" section in [`.PRD/04_PROJECT_SPEC.md`](./.PRD/04_PROJECT_SPEC.md).

## Full design documentation

The design rationale, decision history, and security requirements for this project are all in the [`.PRD/`](./.PRD/) folder.
