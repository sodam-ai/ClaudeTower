# ClaudeTower (working title)

[한국어](./README.md) | [English](./README.en.md)

A statusline CLI for Claude Code. Written so that anyone can follow it from start to finish, even with little or no prior experience with computers or AI tools — this single document covers everything from installation to troubleshooting and legal information. (An experimental feature for registering API-key accounts is included but disabled by default; login-account automation and fully automatic usage-triggered switching still don't exist — see "② Account switching" below.)

> **Current status (important)**: "① Statusline" below is always safe and works right now. "② Account switching" is **already included in the currently released v0.5.0** — you can register, list, delete, and rename API-key accounts, and it is **always disabled by default** — you must read the consent notice and explicitly opt in via `accounts enable`. The command to manually switch between registered accounts (`accounts switch`) exists only in the latest development state and hasn't shipped in a release yet. Login (subscription) account automation still has no code at all, since it still conflicts with Anthropic's official Terms of Service, and there is still no fully automatic usage-triggered switching (see "② Account switching" below for details).
>
> **This document is written against the latest developed state of the code.** The actual downloadable release (GitHub Release) is a snapshot from its own release date, so there can be a gap between what this document describes and what's in the build you download — check "Version history summary" below and the [Releases page](https://github.com/sodam-ai/ClaudeTower/releases/latest) for what's actually in a given release.

---

## Table of Contents

- [① Statusline](#①-statusline-always-safe-install-and-youre-done)
  - [Before you start](#before-you-start)
  - [Prerequisites / required software](#prerequisites--required-software)
  - [Quick start (5 steps)](#quick-start--download-and-run-for-everyone-5-steps)
  - [Installation](#installation-current-status-per-channel)
  - [How to run it](#how-to-run-it)
  - [Command list](#commands-only-what-actually-exists-right-now)
  - [Chat-based toggling](#turn-widgets-onoff-right-from-the-claude-code-chat--no-terminal-needed)
  - [Building from source & testing](#for-developers--building-from-source--testing)
  - [Folder structure](#folder-structure)
  - [Environment variables](#environment-variables-advanced-usersdevelopers)
  - [How it works (concept)](#how-it-works-concept)
  - [Workflow](#workflow)
  - [Security & data flow](#security--data-flow)
  - [File & document locations](#file--document-locations)
  - [Architecture](#architecture-in-plain-terms)
- [② Account switching (experimental, disabled by default)](#②-account-switching-experimental-disabled-by-default)
- [Version history summary](#version-history-summary)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Legal, copyright, license & commercial use](#legal-copyright-license--commercial-use)
- [Full design documentation](#full-design-documentation)

---

## ① Statusline (always safe, install and you're done)

Shows your current project path, active model, context usage, cost, and rate limits at the bottom of the Claude Code screen, with colored gauge bars. **It never touches your Claude account credentials or password.**

Example:
```
Sonnet 5  📁 my-project  🌿 main  컨텍스트 ██░░░ 45%  💰 $1.50  5시간 ████░ 78%·1:41  7일 ███░░ 71%·일06:00
```
(The reset countdown is always shown alongside the percentage, regardless of usage level. If your terminal window is 120 columns or wider, the gauge bars automatically become more detailed — from 5 segments to 10 — with nothing to configure. The Git branch/changes item only appears automatically when the current folder is a git repository, and is hidden automatically otherwise. If you've actually turned on the "②" account auto-switching feature below and switched accounts at least once, an "Active account" item also appears — for the vast majority of users who only use ① (never turned the account feature on), it stays completely invisible. Conversely, if your screen is too narrow for every item to fit on one line, relatively lower-priority items [in this order, from the back: active account → Git → rate limits → cost → context] are automatically dropped so the line never wraps and breaks the display — this also requires no configuration.)

### Before you start

- Since the final product name hasn't been decided, it's currently referred to by the working title "ClaudeTower."
- This project's GitHub repository is **public**. You don't need to be logged into GitHub to see the download page.
- **It is free and intended for personal use only.** It is not designed to be sold commercially or delivered as a paid service to a company (see "Legal, copyright, license & commercial use" below for details).
- **This program is not an official product of Anthropic** (the company that makes Claude and Claude Code). It's an independent companion tool built by an individual developer, with no affiliation, sponsorship, or partnership with Anthropic.

### Prerequisites / required software

**For regular users (just want to use the program)**

| Requirement | Why is it needed? | How to check if you already have it |
|---|---|---|
| A Windows, macOS (Apple Silicon), or Linux (x64) computer | The program currently only runs on these three operating systems | If you're not sure, on Windows check Start Menu → Settings → System → About |
| The latest version of [Claude Code](https://claude.com/claude-code) | This program plugs into Claude Code's "statusline" feature, so Claude Code must already be installed | If Claude Code is already running, you're set |
| A web browser (Chrome, Edge, etc.) | Needed to reach the page where you download the program file (no GitHub login required) | Whatever browser you normally use is fine |

**Important**: Regular users **do not need to install Node.js at all.** Just download one file and you're ready to go.

**Optional — Git**: If [Git](https://git-scm.com) is installed on your computer and the folder you're working in is a git repository, the statusline automatically shows the current branch name and change count too. If Git isn't installed, or it's not a git repository, that's completely fine — this one item is simply hidden, and everything else works exactly as normal.

**For developers (want to modify, build, or test the source code)**

| Requirement | Version |
|---|---|
| [Node.js](https://nodejs.org) | 22 or later |
| [Git](https://git-scm.com) | needed to clone the repository |
| npm (installed automatically with Node.js) | — |

### Quick start — download and run (for everyone, 5 steps)

**You don't need to install Node.js.** Just follow the steps below.

1. Grab the file for your OS from the [Releases page](https://github.com/sodam-ai/ClaudeTower/releases/latest).
   - Windows → `claudetower-win-x64.exe`
   - macOS (Apple Silicon) → `claudetower-macos-arm64`
   - Linux (x64) → `claudetower-linux-x64`
2. Put the file in any folder you like. You can rename it or move it to another folder later — that's fine (see "Can I delete or move the installed file?" below).
3. Open a terminal in that folder.
   - **Windows**: click File Explorer's address bar, clear it, type `cmd`, and press Enter — a black window is your terminal.
   - **macOS**: in Finder, right-click (or two-finger click) an empty area inside the folder and choose "New Terminal at Folder."
4. Run:
   ```
   claudetower-win-x64.exe setup
   ```
   (On macOS/Linux, prefix with `./`: `./claudetower-macos-arm64 setup`)
   - On Windows, you may see a blue **"Windows protected your PC"** warning. This is expected — the program doesn't have an official code signature yet (it's not dangerous). Click `More info`, then `Run anyway` to continue.
   - Answer Y or N to each question (model/location/context/cost/rate-limit) and you're done. The executable automatically copies itself to a fixed, safe location on your computer (`~/.claudetower/bin/`) as part of this step. (On Windows, one more question follows — "make claudetower work as a short command in the terminal?" — either answer works fine; the statusline itself behaves identically.)
5. The statusline appears starting from your next Claude Code interaction — no restart needed.

### Installation (current status per channel)

| Method | Status | Notes |
|---|---|---|
| **Download directly from GitHub Releases** (5 steps above) | ✅ Works now | No Node.js required |
| `curl`/`PowerShell` one-liner (`install.sh`/`install.ps1`) | ✅ Works now (fixed 2026-07-04 — a `main` branch now exists) | No Node.js required, see commands below. **If a terminal feels unfamiliar, we recommend the direct-download method above instead** |
| Build from source | ✅ Works now | For developers, requires Node.js 22+ — see "For developers" below |
| `npm install -g` | ⏸️ Deliberately deferred | Trademark clearance for "ClaudeTower/claudetower" was reviewed and resolved on 2026-07-15 — we decided to keep the name, accepting a low-priority residual risk (`.PRD/01_PRD.md` §7). It's still not a fully, permanently final decision, though, so an npm package name — a resource that's effectively permanent once claimed — won't be published until the name is completely finalized |
| Claude Code marketplace plugin | ✅ Works now (since 2026-09-01, **secondary channel**) | A **thin wrapper** — it does not install the CLI itself. Install the CLI with one of the methods above first, then add the plugin to get `/claudetower:status`, `/claudetower:widgets`, and `/claudetower:config` slash commands (interactive `setup` isn't a slash command yet — still run `claudetower setup` once in a terminal). See [`PLUGIN.md`](./PLUGIN.md) |

macOS/Linux:
```bash
curl -fsSL https://raw.githubusercontent.com/sodam-ai/ClaudeTower/main/install.sh | sh
```
Windows (PowerShell):
```powershell
irm https://raw.githubusercontent.com/sodam-ai/ClaudeTower/main/install.ps1 | iex
```

Marketplace plugin (after installing the CLI):
```
/plugin marketplace add sodam-ai/ClaudeTower
/plugin install claudetower@claudetower-marketplace
```

### Can I delete or move the installed file?

**Yes.** The first time you run `setup`, the executable automatically copies itself to a fixed location on your computer (`~/.claudetower/bin/`) and settles there safely. After that, you're free to delete, rename, or move the file you originally downloaded — it no longer matters.

If you accidentally delete that fixed-location copy too and the statusline stops showing up, just run `claudetower setup` again — it repairs itself automatically.

### How to run it

**Can I just double-click it?** If you double-click the file, a black window will flash open and close almost instantly — **this is not a malfunction.** This program only does something useful when run together with a "command." Running it with no command just shows a brief usage message and exits. To actually use it, you must open a terminal and type the command yourself, as described in "Quick start" above.

**Do I need to open a terminal every time?** No. **You only need to run `setup` once.** After that, the program runs automatically and quietly in the background every time you use Claude Code, feeding information into the statusline. You'd only need to open a terminal again to change which items are shown (`setup` again), check whether it's still correctly installed (`status`), or remove the registration (`uninstall`).

### Commands (only what actually exists right now)

> **Note**: The 5 steps above are already the complete statusline setup. The commands below are only for later, optional tweaks. If you answered Y to "make `claudetower` work as a short command in the terminal?" during `setup`, bare `claudetower` already works in new terminals; if you answered N (or installed an older version), it may not yet. So:
> - **No terminal needed**: add this as a Claude Code marketplace plugin (see the "Claude Code marketplace plugin" row above), then use `/claudetower:widgets`, `/claudetower:status`, `/claudetower:config` right in the chat.
> - If you still want to type it in a terminal, use the full path instead of bare `claudetower`: `~/.claudetower/bin/claudetower.exe` (macOS/Linux: `~/.claudetower/bin/claudetower`).

- `claudetower --version` / `--help`
- `claudetower setup` — pick which statusline widgets to show + auto-register with Claude Code (includes the self-install step above). To change which items are shown later, just run this again (answer `Y` for what you want on and `n` for what you want off)
- `claudetower status` — check whether it's currently installed and which widgets are enabled
  ```
  Install status: installed (claudetower's statusline is registered with Claude Code)
  Widgets shown: model, project location, git branch/changes, context usage, cost, rate limits (5h/7d), active account
  ```
- `claudetower widgets` — check which widgets are currently on
- `claudetower widgets off <widgets...>` / `claudetower widgets on <widgets...>` — turn only the named widgets on/off (everything else stays as-is — no need to re-answer every `setup` question). Widget names: `model`, `location`, `git`, `context`, `cost`, `rate_limit`
- `claudetower config statusline-refresh <seconds>` — adjusts how often the statusline refreshes (default 3s; <strong>the recommended value is 5s</strong> — measured runs show CPU load drops to roughly 7.6% at a 1s interval, about 2.5% at 3s, and about 1.5% at 5s. This saving multiplies with each extra session you keep open at once. The project's own recommended range is 2-5s). This value is kept even if you run `setup` again. You can also just say "slow down the statusline refresh" in the Claude Code chat instead of using a terminal
- `claudetower config powerline <on|off>` — switches the separator between widgets from two spaces to Powerline-style arrows (just the divider glyphs, no color theme; off by default). If your terminal doesn't have a Nerd Font installed, the arrows may render as broken glyphs, so check after turning it on
- `claudetower config padding <n>` — adjusts the official Claude Code statusLine's left/right padding (character count, default 0). Example: `claudetower config padding 2`
- `claudetower uninstall` — safely removes only the statusline registration (leaves your other Claude Code settings untouched)
- `claudetower statusline` — the renderer Claude Code invokes internally (you won't run this by hand)

> `accounts` commands have already been included since v0.5.0, but are **disabled by default** — until you run `accounts enable` to consent, everything except `status`/`config` lookups is refused. This is a fully separate feature from the statusline; see "② Account switching" below for details. Commands actually included in v0.5.0: `accounts status` (check components) · `accounts config` (pre-set switch thresholds etc.) · `accounts enable` (opt in after reading consent) · `accounts add --api-key <label> <key>` (register an API-key account) · `accounts list` (view registered accounts) · `accounts remove <label>` (delete one account) · `accounts rename <old-label> <new-label>` (rename it) · `accounts disable` (turn back off) · `accounts diagnose-quota <label>` (check real usage). `accounts switch <label>` (manually switch between registered accounts) only exists in the latest development state, not yet in a release.

### Turn widgets on/off right from the Claude Code chat — no terminal needed

Add this plugin from the Claude Code marketplace (see the "Claude Code marketplace plugin" row in "Install methods" above), and you can adjust things directly from the chat, no terminal needed.
- `/claudetower:widgets` — check which widgets are currently on
- `/claudetower:widgets off <widgets...>` / `/claudetower:widgets on <widgets...>` — turn only the named widgets on/off
- `/claudetower:status` — check install status
- `/claudetower:config` — adjust the refresh interval and more

Widget names: `model`, `location`, `git`, `context`, `cost`, `rate_limit`.

### For developers — building from source & testing

```bash
git clone https://github.com/sodam-ai/ClaudeTower.git
cd ClaudeTower
npm install
npm run build
```
This produces one executable in `dist/` matching your OS.

| Command | What it does |
|---|---|
| `npm install` | Installs dev-only dependencies (the built executable itself has zero runtime dependencies) |
| `npm run build` | Produces the executable in `dist/` |
| `npm test` / `npm run test:display` | Runs the statusline (Display) feature tests |
| `npm run lint` | Checks code style |
| `npm run lint:boundary` | Verifies the Display and Account modules never mix |
| `npm run verify` | Runs lint, module-boundary check, and tests together (recommended before committing) |

### Folder structure

Here's the main layout of the repository root (regular users don't need to look at this).

```
ClaudeTower/
├── bin/claudetower.js       # CLI entry point (command routing)
├── src/
│   ├── display/               # Statusline feature — a safe module that never touches account data
│   │   ├── widgets/            # model, location, git, context, cost, rate-limit widgets
│   │   ├── config/             # settings read/write, gauge & text-safety helpers, etc.
│   │   └── cache/               # Local Git-info cache
│   └── accounts/              # Account registration/switching code — included in the exe since v0.5.0 (disabled by default; see "② Account switching" above)
├── test/                     # Tests for the display/accounts modules
├── scripts/                  # Build & module-boundary check scripts
├── .PRD/                     # Design rationale & decision history (for developers)
├── install.sh / install.ps1  # One-liner install scripts
└── LICENSE                   # Full text of the Apache License 2.0
```

### Environment variables (advanced users/developers)

Regular users can skip this table entirely — all of these are optional, and the program works normally with none of them set.

| Variable | Purpose | Notes |
|---|---|---|
| `COLUMNS` | Terminal width in columns — set automatically by Claude Code | Used for auto gauge-width expansion and line-length management (see "Example" above). You'll rarely need to set this by hand |
| `CLAUDETOWER_SETTINGS_PATH` | Path to use instead of Claude Code's `settings.json` | Mainly for testing/isolated runs. Defaults to `~/.claude/settings.json` if unset |
| `CLAUDETOWER_WIDGET_CONFIG_PATH` | Path to use instead of the widget settings file (`config.json`) | Same purpose as above |
| `CLAUDETOWER_INSTALL_DIR` | Overrides where the executable installs itself | Same purpose as above |
| `CLAUDETOWER_CACHE_DIR` | Overrides where the Git-info cache is stored | Same purpose as above |

> These variables mostly exist so this project's own automated tests can run in isolation without touching your real files. You'll rarely need to set them yourself, but they're documented here precisely in case you ever need to reproduce or diagnose an issue.

### How it works (concept)

In plain terms: every time you interact with Claude Code, it briefly shares your "current situation" (which folder you're working in, which model you're using, how much you've spent, etc.) with this program. The program takes that information and turns it into a "nicely formatted single line," which it hands back to Claude Code, and Claude Code displays that line at the bottom of your screen. Think of it like having someone sit next to you whose only job is to make a little status sign — they can see where you are (your folder) and what time it is (rate-limit reset time), and they make you a sign based on that. But they never touch your wallet or ID (your account credentials).

### Workflow

Here's the actual sequence of what happens inside your computer to produce one line on screen (all of it happens locally, and it usually takes well under a second).

1. Claude Code runs this program immediately whenever something happens that could change what's on screen — for example, while you're chatting. On top of that, even while you're sitting idle, it also runs the program once every so often (default 3 seconds, adjustable via `config statusline-refresh`) so nothing goes stale — this interval is an <strong>idle-time backup timer</strong>, not "the only time it refreshes." Lowering it doesn't make the display more responsive, so we recommend leaving it at the recommended value (5s) from the command list above rather than lowering it.
2. Claude Code sends this program a short block of text (JSON) describing "the current situation" — your working folder path, the model in use, context usage, cost, and rate limits.
3. This program checks each enabled widget (model/location/git/context/cost/rate limits) one by one — any item with no value or nothing to show is silently skipped (for example, the Git item is skipped if the folder isn't a git repository).
4. For the Git item, it asks the `git` program installed on your computer for the branch name and change count. If it's asked again within 5 seconds in the same session, it reuses the value it just checked instead of asking again (a small local cache to reduce load — see "Security & data flow" below).
5. It joins the confirmed items into one human-readable line. If the line would be too long for your screen width, lower-priority items are automatically dropped first so the line never wraps.
6. It hands the finished line back to Claude Code, which displays it exactly as-is at the bottom of your screen.

### Security & data flow

- Nothing is ever sent externally. Everything runs locally on your machine.
- Each time Claude Code hands the statusline program your current state (project path, context usage, etc.), it's only rendered on screen — account information and conversation content are never stored.
- Even if a displayed value (e.g., a project folder name) contains an unusually long string or terminal control characters, it's automatically and safely cleaned up (length-limited and stripped of risky characters) before being shown, so the display never breaks. The total length of the whole line is also automatically kept within your screen width, not just each individual item (see "Workflow" step 5 above).
- The Git branch name and change count are cached locally for a brief 5 seconds and then reused. This cache file also never contains any personal or account information (only the branch name and a count of changed files are stored), and the design ensures that even if this caching fails for any reason, it never affects what's shown on screen (see "File & document locations" below).
- The only files this program actually saves to your computer are the small "which items to show" list and the Git cache above — neither ever contains any personal or account information.

### File & document locations

Here's where this program actually creates or uses files on your computer.

| File/folder | Location (Windows example) | What is it? |
|---|---|---|
| Installed executable | `C:\Users\YourName\.claudetower\bin\claudetower.exe` | The file `setup` automatically copies itself to — this is the actual "real" program |
| Widget settings | `C:\Users\YourName\.claudetower\config.json` | A small file storing which items to display |
| Git info cache | `C:\Users\YourName\.claudetower\cache\` | A folder that briefly (5 seconds) caches the Git branch name and change count to reduce load. No personal or account information. Safe to delete — it's recreated automatically next run |
| Claude Code global settings | `C:\Users\YourName\.claude\settings.json` | Claude Code's own settings file. This program only uses the "statusLine" portion of it and never touches anything else in this file |
| Settings backup | `C:\Users\YourName\.claude\settings.json.bak` | An automatic backup of your settings taken right before any change — useful if something goes wrong |

> On macOS/Linux, replace `C:\Users\YourName` with `~` (your home folder, usually `/Users/YourName` or `/home/YourName`).

**For developers**: detailed design rationale and decision history are kept in the `.PRD/` folder in the repository (regular users don't need to look at this).

### Architecture (in plain terms)

This program was designed from the start with the "statusline" part and the "account-switching" part completely separated. The "statusline room" only displays information on screen, so it's always safe, and it has no code-level connection to the "account-switching room" at all (the repository proves this independence automatically on every build). The "account-switching room" has shipped inside the executable since v0.5.0, but its door is locked by default — it only opens once you consent via `accounts enable` — and even inside, what's officially available today is registering, listing, deleting, and renaming an API-key account; actually switching between registered accounts still only exists in development. Login-account automation and fully automatic switching still don't exist because of the Terms-of-Service conflict (see "② Account switching" below for details).

---

## ② Account switching (experimental, disabled by default)

Originally, this project planned to add a feature that would let you automatically switch between multiple Claude accounts. On 2026-07-15, after reading Anthropic's official Terms of Service directly, we confirmed there is no safe way to automatically cycle login (subscription) accounts.

- Anthropic explicitly prohibits third-party tools from logging in with subscription (Free/Pro/Max) credentials and using that account on a user's behalf. As of 2026-01-09, this is also technically blocked server-side — confirmed by multiple independent news sources.
- Access via API key, on the other hand, is an **explicit exception** Anthropic's Terms of Service carves out from this automation ban. However, whether registering and rotating multiple API keys at once runs afoul of a separate anti-abuse clause has not been confirmed — we don't assume it's safe.

After an internal re-review (background and reasoning recorded in the repository's `.PRD/07_OAUTH_FLOW_SPEC.md`), we decided to **keep login-account automation out entirely, and proceed only with the hybrid API-key path that the Terms of Service carve out as an exception**. As a result, here's exactly what's already included and working in the current release (v0.5.0), what exists only in the latest development state and hasn't shipped yet, and what still doesn't exist at all.

> **Supported platforms (important, 2026-08-20)**: This "② Account switching" feature is **Windows and macOS only**. Linux is not supported for this feature (we don't have a physical Linux environment to live-verify the real credential store, and chose not to ship it unverified — see `CHECKPOINT.md` for details). On Linux, the **statusline (①) feature keeps working normally**, unaffected by this restriction.

**Already included in the current release (v0.5.0)** (disabled by default — see "How to turn it on" below first, **Windows/macOS only**):
- `claudetower accounts status` — check whether the account module is on, and which parts are implemented vs. not (read-only)
- `claudetower accounts config` — pre-set switch threshold, port, etc. locally without registering any account
- `claudetower accounts enable` — shows the consent notice below and requires you to type `y` yourself before it turns on
- `claudetower accounts add --api-key <label> <key>` — registers an API-key account. The key value is stored only in this computer's OS credential vault (Windows: Credential Manager / macOS: Keychain) and is never transmitted anywhere
- `claudetower accounts list` — view registered accounts along with the usage last checked via `diagnose-quota`, when that usage is expected to reset, and when/which project folder each account was last used from (key values themselves are never shown)
- `claudetower accounts remove <label>` — deletes a single account (`[y/N]` confirmation required, irreversible). For deleting everything at once, see `account-purge` below
- `claudetower accounts rename <old-label> <new-label>` — renames the account's display label only (the stored key value is untouched)
- `claudetower accounts disable` — turn it back off (registered account info is kept)
- `claudetower accounts diagnose-quota <label> [--model <model-id>]` — sends one tiny real request (requires `[y/N]` confirmation, incurs a negligible real cost) using the registered account, to check whether usage info comes back in the expected format. **Does not switch accounts** — it's diagnostic only, and the result is shown in `accounts list` together with when it was last checked

**Exists only in the latest development state, not yet in a release** (from the GitHub source code — planned for the next release, but not in the v0.5.0 build you download today):
- `claudetower accounts switch <label>` — switches to one of your registered accounts when **a person runs the command themselves** (manual switching, not automatic detection). It applies immediately with no confirmation step needed (it's reversible — just `switch` again — so it's not risky the way deletion is), only works between API-key accounts (you cannot switch to a login/subscription account), and each switch is recorded with when it happened and which account it switched from/to

**What still doesn't exist at all**:
- Automatic registration/cycling of login (subscription) accounts — no code exists for this, due to the Terms-of-Service issue above
- Importing an already-logged-in Claude Code account as-is (`--import`)
- **The program automatically switching accounts on its own (fully automatic)** — even with multiple accounts registered, nothing automatically switches to the next account when usage runs out today; only running `accounts switch` yourself changes it (see above — and that command itself hasn't shipped in a release yet)

**How to turn it on, and what you're consenting to**: Running `claudetower accounts enable` shows a consent notice summarizing the above, and it only activates once you type `y` yourself. If you never run `enable`, this feature stays off indefinitely and has zero effect on the statusline feature.

The statusline (Display) feature keeps working safely regardless of any of this — the repository automatically verifies on every build that the two parts are completely separated at the code level.

---

## Version history summary

Officially released versions (current latest: v0.5.0). Click to expand.

<details>
<summary><strong>v0.5.0</strong> — Account registration & management officially included (latest)</summary>

Starting with this version, the "② Account switching" feature ships in an actual release for the first time (still disabled by default). Once you consent via `accounts enable`, you can register, list, delete, and rename API-key accounts; the key values you register are stored only in this computer's OS credential vault (Windows Credential Manager / macOS Keychain) and never saved anywhere in plain text. `accounts diagnose-quota` lets you check real usage, and `accounts list` shows the usage last checked. Internal safeguards were also added so account data stays intact even with multiple program windows open at once. **However, actually switching accounts is not in this version** — only registering, listing, and deleting are available (the manual `accounts switch` command is in development after this version — see "② Account switching" above). Login (subscription) account automation is still not built, due to the Terms-of-Service issue. This account feature is Windows/macOS only; on Linux, only the statusline (①) feature is supported.
</details>

<details>
<summary><strong>v0.4.0</strong> — Dynamic gauge width + config padding command</summary>

Added automatic gauge-bar widening for wide terminals (120+ columns — bars go from 5 to 10 segments for finer detail) and a new `claudetower config padding <n>` command (default 0) to adjust the statusline's left/right padding. Neither change affects narrow terminals or users who keep the defaults (the width auto-adjustment always falls back to the original 5 segments when narrow, and padding's default is still 0, same as before). Also hardened `claudetower config statusline-refresh` against invalid input like empty strings (an internal robustness fix only — no visible behavior change).
</details>

<details>
<summary><strong>v0.3.0</strong> — Added Powerline separator command</summary>

A new `claudetower config powerline <on|off>` command lets you switch the separator between statusline widgets from the default plain double-space to a Powerline-style arrow glyph (U+E0B1). There's no color theme, just the glyph, and it defaults to OFF (opt-in), so existing users see zero behavior change unless they turn it on. This glyph uses a Nerd Font Private-Use-Area character, so terminals without a Nerd Font installed may show it as a broken or blank character — try it and check before committing to it.
</details>

<details>
<summary><strong>v0.2.0</strong> — Install stabilization, self-healing, widget menu</summary>

Fixed file corruption when the install script and statusline ran at the same time, and fixed the root cause of the `/claudetower-widgets` command disappearing, adding a self-healing fix. Added a Windows PATH auto-registration option and a `config statusline-refresh` command to adjust refresh speed (default refresh interval also changed from 1s to 3s), and closed a gap where `uninstall` could accidentally delete config/skill files. Running `/claudetower-widgets` with no arguments now shows a check-box menu for toggling widgets, and boundary-value bugs in the context, cost, model-name/folder-name, and reset-time displays were fixed. After reviewing Anthropic's Terms of Service, the account auto-switching feature was decided against as of this point in time, so ClaudeTower remained a statusline-only (Display) tool (this decision was later revisited internally, though the related code is still not included in the distributed release — see "② Account switching" above).
</details>

<details>
<summary><strong>v0.1.10</strong> — Percentage display fix, one-liner install stabilized</summary>

Fixed impossible out-of-range percentage displays. Stabilized the curl/PowerShell one-liner install. Added an "not an official Anthropic product" disclaimer.
</details>

<details>
<summary><strong>v0.1.9</strong> — Quick widget toggle + chat-based setup</summary>

Added `claudetower widgets on/off`. Auto-installs the `/claudetower-widgets` chat command.
</details>

<details>
<summary><strong>v0.1.8</strong> — Always-on reset countdown, install reliability</summary>

Reset countdown is now always shown regardless of usage level (previously only shown at 70%+). Also fixed a bug where re-running `setup` to install a new version could silently fail because Claude Code kept the executable in use (now copies to a temp file first, then swaps it in safely, with automatic retry).
</details>

<details>
<summary><strong>v0.1.7</strong> — Reset countdown display</summary>

Shows the reset countdown/time once a rate limit reaches a warning level (70%+).
</details>

<details>
<summary><strong>v0.1.6</strong> — Fixed install location, auto-repair</summary>

Installed files no longer break if renamed, moved, or deleted (auto-settles into a fixed safe location).
</details>

<details>
<summary><strong>v0.1.5</strong> — Added install status check</summary>

Added `status` command; `uninstall` now double-checks that removal actually completed.
</details>

<details>
<summary><strong>v0.1.4</strong> — Model widget, cleaner percentages</summary>

Restored the "active model" widget; fixed a bug where usage percentages sometimes displayed messy decimals (e.g. `14.000000000000002%`).
</details>

<details>
<summary><strong>v0.1.3</strong> — Uninstall command, gauge improvements</summary>

Added `uninstall` command, improved gauge-bar colors, faster location updates.
</details>

<details>
<summary><strong>v0.1.2</strong> — Fixed double-click crash</summary>

Fixed an issue where double-clicking the file caused the window to close instantly.
</details>

<details>
<summary><strong>v0.1.1</strong> — Added gauge bars</summary>

Added gauge-bar visuals alongside percentage numbers for easier reading.
</details>

<details>
<summary><strong>v0.1.0</strong> — Initial release</summary>

Initial release. Shows location, context, cost, and rate limits; `setup` installation wizard.
</details>

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| **404 error** on the Releases page | Double-check that you typed the URL correctly (watch for typos and capitalization). |
| **"Run anyway" button doesn't appear** on the blue warning | You need to click "More info" first — the button appears below it. |
| **Double-clicking the exe opens a window that closes immediately** | Not a malfunction — running with no arguments just shows help text and exits. To actually use it, open a terminal and type a command directly, e.g. `claudetower-win-x64.exe setup`. |
| `claudetower status` says **"registered but the executable can't be found (broken)"** | You've deleted or moved the file that was installed. Run `claudetower setup` again to repair it automatically. |
| **Ran `setup` to install a new version, but nothing changed** (e.g. version number stays the same) | Since v0.1.8, this retries automatically a few times, but antivirus scanning or similar can occasionally take even longer. Close Claude Code briefly and run `setup` again. |
| **The statusline doesn't show up** | There are three possible causes. ① Settings don't apply instantly — try one more Claude Code interaction. ② You may not have accepted the workspace trust prompt for this folder yet — if so, the statusline never runs at all, and you'll see `statusline skipped · restart to fix`. Accept the trust prompt, then restart Claude Code. ③ If `disableAllHooks` is turned on in your Claude Code settings, the statusline is disabled along with everything else (official Claude Code behavior) — turn it off if you don't need it. |
| **The context percentage looks off or empty** | It can be empty early in a session or right after `/compact` — that's expected, official Claude Code behavior. |
| **Windows shows a warning when running the executable** | It isn't code-signed yet, so Windows may show an "unknown publisher" warning. Click "More info" then "Run anyway" — this is expected before an official signed release. |
| For developers — **`npm run build` fails** | Check that `node --version` is 22 or later. |

**Still stuck?** Take a screenshot of the output of `claudetower status` and share it on the [Issues page](https://github.com/sodam-ai/ClaudeTower/issues) — it makes diagnosing the issue much faster.

## FAQ

- **Does installing this automatically collect my account info?** No. Installing and using the statusline alone never touches account information at all. The account-registration feature is disabled by default — only after you explicitly consent via `accounts enable` and explicitly enter a key via `accounts add` does that account info (an API key) get stored in this computer's OS credential vault. Nothing is collected unless you explicitly tell it to.
- **Does anything get sent over the internet?** No, everything runs locally only.
- **Are there plans to build account switching?** Automatically cycling login (subscription) accounts has been found to conflict with Anthropic's Terms of Service, so it won't be built. That said, "registering" API-key accounts — the path the Terms of Service carve out as an exception — has already been experimentally included since v0.5.0, disabled by default. Manually switching between registered accounts yourself (`accounts switch`) is planned for the next release; the program automatically detecting usage and switching fully on its own is still not planned (see "② Account switching" above for details).
- **Is it really okay to delete the file I originally downloaded?** Yes, as long as you've run `setup` at least once first — see "Can I delete or move the installed file?" above.
- **Does it cost money?** No, this program itself is free. Note that the "cost ($)" figure it *displays* is a separate thing — that's the cost of using Claude Code (the AI) itself, unrelated to this program.
- **Why does the name say "working title"?** Trademark review finished on 2026-07-15. The result: we decided to keep the name "ClaudeTower" as-is, accepting a low-priority residual risk (see "Legal, copyright, license & commercial use" below for details). That said, we haven't fully ruled out changing the name later — if the user base grows significantly, or if Anthropic reaches out directly — so it's still labeled a "working title" rather than a fully final name.
- **Can I use this at my company?** It's designed for personal use and is not intended for commercial sale or delivery to a company. Please read "Legal, copyright, license & commercial use" below carefully.

## Legal, copyright, license & commercial use

> ⚠️ **This section is not legal advice.** It describes this project's current status honestly and as-is, clearly distinguishing between confirmed facts and matters that are still undecided. If you need a legally significant determination, please consult a qualified professional such as a lawyer.

**This program's relationship with Anthropic**: This program is not made or officially endorsed by Anthropic (the company that makes Claude and Claude Code). It is an independent companion tool built by an individual developer, with no affiliation, sponsorship, or partnership with Anthropic whatsoever. The word "Claude" appears in this document solely to describe the fact that this program works alongside Claude Code — it does not mean Anthropic created, endorses, or is responsible for this program.

**License (confirmed facts)**: This project uses the **Apache License 2.0**, a widely used open-source license with an explicit patent grant (unlike MIT). The copyright holder is **SoDam AI Studio**, and the full license text is in the [`LICENSE`](./LICENSE) file in the repository.

**License (not yet finalized)**: The final product name isn't in a fully, permanently finalized state. Trademark review for the name "ClaudeTower" was completed on 2026-07-15, and the decision was to keep this name, accepting a low-priority residual risk (to be revisited only if the user base grows significantly or Anthropic reaches out directly). Until this "working title" status is fully resolved, the `npm install -g` distribution channel is also deliberately not being opened (an npm package name is effectively permanent once claimed).

**Commercial use — strict prohibition**: This program is not designed for ❌ commercial sale, ❌ being offered as a paid service, or ❌ paid delivery to a company or organization. **This program is distributed for free, personal use only.** Reason for this strict limitation: this project planned to add an automatic multi-account switching feature, and after reading Anthropic's official Terms of Service directly, we confirmed that automating login-account cycling conflicts with Claude's terms of service (see "② Account switching" above). Since v0.5.0, the API-key registration path the Terms of Service carve out as an exception is **actually included in the build you download** — but whether rotating multiple API keys itself runs afoul of a separate anti-abuse clause is still unconfirmed. In other words, this risk is no longer hypothetical — it exists right now, in the actual release you can download. It doesn't apply to anyone who leaves the feature off and only uses the statusline (disabled by default, fully separated at the code level), but the commercial-use exclusion — a design principle from the very beginning meant to avoid amplifying exactly this kind of risk — remains in place.

**What the license actually permits vs. what this project recommends (important)**: Apache License 2.0 itself contains no "no commercial use" clause. As long as you comply with its conditions (keeping copyright and license notices, etc.), modification, copying, redistribution, and commercial use are, in principle, permitted — it is a widely used permissive license. In other words, the "commercial use — strict prohibition" statement above does **not mean the license legally forbids it — it means this project does not recommend it (a design intent).**

| What you want to do | Does the license allow it? | Does this project recommend it? |
|---|---|---|
| Modify the code | Allowed | Recommended (keep copyright/license notices) |
| Copy or fork it as-is | Allowed | Recommended |
| Redistribute a modified version | Allowed (with license copy + copyright notice) | Recommended |
| Use it as educational material | Allowed | Recommended |
| Sell it / turn it into a paid service | Permitted by the license terms alone | Not recommended (see above) |
| Deliver it to a company/client | Permitted by the license terms alone | Not recommended (see above) |

If the project owner wants to legally restrict commercial use with binding force, switching away from Apache 2.0 to a different license scheme would be required — that decision is left to the project owner.

**On reusing external code and ideas**: While designing this project, several other open-source statusline/account-management tools were referenced (e.g., ccstatusline, starship-claude, and others). However, this project did not copy their source code — only design ideas and patterns were referenced. If any actual code is borrowed in the future, the attribution requirements of the original project's license will be followed (this has not yet been fully reviewed legally).

**Limitation of liability**: This program is provided **"AS IS"** under the standard terms of the Apache License 2.0, without any warranty of any kind, express or implied. The copyright holder (SoDam AI Studio) is not liable for any damages arising from the use of this program (see the [`LICENSE`](./LICENSE) file for the exact legal text).

**About AI's involvement in development**: A substantial part of this project's code and documentation was written with the help of an AI coding tool (Claude Code) — this is recorded in the repository's commit history via "Co-Authored-By: Claude" trailers. Whether AI-generated or AI-assisted content is copyrightable, what training data it derives from, and whether it might resemble or infringe existing works are all legal questions that differ by jurisdiction and remain unsettled. If you plan to use, redistribute, or commercially exploit this project as-is or modified, please be aware that it includes AI-assisted content, and verify copyright, provenance, and commercial-use eligibility yourself where needed (needs legal review).

**About the NOTICE file**: This project does not include a separate Apache `NOTICE` file. Apache License 2.0 Section 4(d) only requires you to carry forward a `NOTICE` file's contents when a different Apache-licensed dependency already ships one, and `@napi-rs/keyring` (OS credential-store access; its native binary is actually distributed alongside the executable as `keyring-native-*.node`) is **MIT licensed**, not Apache (confirmed directly from `node_modules/@napi-rs/keyring/LICENSE` in the repository), so it isn't subject to that clause. That said, the MIT license's own requirement to carry its copyright/permission notice has been fulfilled separately — see [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for the notice reproduced in full. The build tools, esbuild and eslint, remain development-only and are excluded from that file since they are not included in the distributed executable.

For more background, see the "법률·저작권·라이선스·상업적 사용 요구사항" section in [`.PRD/04_PROJECT_SPEC.md`](./.PRD/04_PROJECT_SPEC.md).

## Full design documentation

The design rationale, decision history, and security requirements for this project are all in the [`.PRD/`](./.PRD/) folder.
