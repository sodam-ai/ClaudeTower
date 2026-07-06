# ClaudeTower Complete User Guide (English)

> This guide is written so that anyone can follow it from start to finish, even with little or no prior experience using computers, smartphones, or AI tools. Wherever a technical term appears, a plain-language explanation follows right next to it.

**Document version**: This guide covers ClaudeTower **v0.1.10**.

---

## Table of Contents

1. [What is this program?](#1-what-is-this-program)
2. [Before you start](#2-before-you-start)
3. [Prerequisites / required software](#3-prerequisites--required-software)
4. [How to download](#4-how-to-download)
5. [Quick start (installation)](#5-quick-start-installation)
6. [How to run it](#6-how-to-run-it)
7. [How to use it](#7-how-to-use-it)
8. [How it works (concept)](#8-how-it-works-concept)
9. [Full command list](#9-full-command-list)
10. [Workflows (typical usage flow)](#10-workflows-typical-usage-flow)
11. [Version history summary](#11-version-history-summary)
12. [Security & data flow](#12-security--data-flow)
13. [Architecture](#13-architecture)
14. [File & document locations](#14-file--document-locations)
15. [Troubleshooting](#15-troubleshooting)
16. [Frequently asked questions (FAQ)](#16-frequently-asked-questions-faq)
17. [Legal, copyright, license & commercial use](#17-legal-copyright-license--commercial-use)

---

## 1. What is this program?

**ClaudeTower** (working title — the final name has not been decided yet) is a small companion program that shows you a live summary at the bottom of the **Claude Code** screen (the tool that lets you have an AI write code for you).

For example, it shows a single line like this at the bottom of your screen:

```
Sonnet 5  📁 my-project  컨텍스트 ██░░░ 45%  💰 $1.50  5시간 ████░ 78%·1:41  7일 ███░░ 71%·일06:00
```

What this line tells you:
- **Sonnet 5** — which AI model you're currently using (the model name is shown as-is)
- **📁 my-project** — the name of the folder you're currently working in
- **컨텍스트 (Context) ██░░░ 45%** — how much of the AI's "memory" of your conversation is currently full (once it fills up, the AI starts forgetting earlier parts of the conversation)
- **💰 $1.50** — how much this conversation has cost so far, in US dollars
- **5시간 (5-hour) ████░ 78%·1:41** — you've used 78% of your 5-hour usage limit, and it resets in 1 hour 41 minutes
- **7일 (7-day) ███░░ 71%·일06:00(Sun 06:00)** — you've used 71% of your 7-day usage limit, and it resets Sunday at 6:00 AM

**Most importantly**: this program **never touches your Claude account ID, password, or authentication credentials in any way.** It only displays information on screen — nothing more.

---

## 2. Before you start

- This project is still in its **early development stage (Phase 1)**. The "statusline" feature described here is fully working right now, but the "automatic multi-account switching" feature (Account module) **does not have any code written for it yet.**
- Since the final product name hasn't been decided, it's currently referred to by the working title "ClaudeTower."
- This project's GitHub repository is **public**. You don't need to be logged into GitHub to see the download page.
- **It is free and intended for personal use only.** It is not designed to be sold commercially or delivered as a paid service to a company (see Section 17 for details).
- **This program is not an official product of Anthropic** (the company that makes Claude and Claude Code). It's an independent companion tool built by an individual developer, with no affiliation, sponsorship, or partnership with Anthropic (see Section 17 for details).

---

## 3. Prerequisites / required software

### For regular users (just want to use the program)

| Requirement | Why is it needed? | How to check if you already have it |
|---|---|---|
| A Windows, macOS (Apple Silicon), or Linux (x64) computer | The program currently only runs on these three operating systems | If you're not sure, on Windows check Start Menu → Settings → System → About |
| The latest version of [Claude Code](https://claude.com/claude-code) | This program plugs into Claude Code's "statusline" feature, so Claude Code must already be installed | If Claude Code is already running, you're set |
| A web browser (Chrome, Edge, etc.) | Needed to reach the page where you download the program file (no GitHub login required) | Whatever browser you normally use is fine |

**Important**: Regular users **do not need to install Node.js at all.** Just download one file and you're ready to go.

### For developers (want to modify or build the source code)

| Requirement | Version |
|---|---|
| [Node.js](https://nodejs.org) | 22 or later |
| [Git](https://git-scm.com) | needed to clone the repository |
| npm (installed automatically with Node.js) | — |

---

## 4. How to download

1. Open your web browser (no GitHub login required).
2. Go to:
   ```
   https://github.com/sodam-ai/ClaudeTower/releases/latest
   ```
3. This is the "latest release" page. Scroll down to the **"Assets"** section and click the file matching your operating system.

   | Your computer | File to download |
   |---|---|
   | Windows (most PCs) | `claudetower-win-x64.exe` |
   | macOS, Apple Silicon (M1/M2/M3, etc.) | `claudetower-macos-arm64` |
   | Linux, 64-bit | `claudetower-linux-x64` |

4. Once downloaded, the file usually lands in your Downloads folder.

> ⚠️ **Getting a 404 Not Found error?** Double-check that you typed the URL correctly (watch for typos and capitalization).

### 4-1. (Optional) Install with one terminal command — for people already comfortable with a terminal

If you've used a terminal before, you can skip steps 1-4 above and do the download-and-install in a single command. **If this is your first time using a computer or a terminal, we recommend the "download directly" method above instead** — copying and pasting a command can be confusing if it's unfamiliar.

**Windows (PowerShell)**:
```powershell
irm https://raw.githubusercontent.com/sodam-ai/ClaudeTower/main/install.ps1 | iex
```

**macOS / Linux (terminal)**:
```bash
curl -fsSL https://raw.githubusercontent.com/sodam-ai/ClaudeTower/main/install.sh | sh
```

This one line automatically finds and downloads the right executable for your operating system from the GitHub Release, then installs it to a fixed location on your computer (`~/.claudetower/bin/`). Once it finishes, continue with "Run the setup wizard" in Section 5.

---

## 5. Quick start (installation)

### 5-1. Move the file wherever you like

You can place the downloaded file in any folder — for example, a folder like `D:\Test_Dev\test1`. You can also rename it if you want.

### 5-2. Open a terminal (the black command-typing window)

A "terminal" is a window where you type commands to instruct your computer. It may look unfamiliar at first, but it's simple once you know the steps.

**Windows**:
1. Open File Explorer and navigate to the folder containing the file.
2. Click the **address bar** at the top of the window.
3. Clear it, type `cmd`, and press Enter.
4. A black window opens — that's your terminal.

**macOS**:
1. Open `Finder` and navigate to the folder.
2. Right-click (or two-finger click) an empty area inside the folder and choose "New Terminal at Folder."

### 5-3. Run the setup wizard

Type this into the terminal and press Enter (replace the filename with whatever you actually downloaded):

**Windows**:
```
claudetower-win-x64.exe setup
```

**macOS / Linux**:
```
./claudetower-macos-arm64 setup
```

- On Windows, you may see a blue **"Windows protected your PC"** warning. This is expected — the program doesn't have an official code signature yet (it's not dangerous). Click `More info`, then `Run anyway` to continue.
- You'll be asked 5 questions. Press Enter to keep the default (yes), or type `n` and press Enter to turn an item off.
  ```
  Show active model? (Y/n):
  Show project location? (Y/n):
  Show context usage? (Y/n):
  Show cost? (Y/n):
  Show rate limits (5h/7d)? (Y/n):
  ```
- (Windows only) One more question follows:
  ```
  Make "claudetower" work as a short command in the terminal? (Y/n):
  ```
  Answering `Y` means that from the next terminal window on, typing just `claudetower` will work. This changes a setting for your whole computer, so if you'd rather not, answer `n` — the statusline itself works identically either way (see section 9).
- If you see "설정 완료" (setup complete) and a message about being copied to a safe location, it worked.

### 5-4. Check it in Claude Code

Open a new Claude Code session (or start a new conversation) and the statusline will appear at the bottom of your screen on your next interaction. **You don't need to restart your computer.**

---

## 6. How to run it

### Can I just double-click it?

If you double-click the file, a black window will flash open and close almost instantly — **this is not a malfunction.** This program only does something useful when run together with a "command." Running it with no command just shows a brief usage message and exits.

**To actually use it, you must open a terminal and type the command yourself, as described in Section 5.**

### Do I need to open a terminal every time?

No. **You only need to run `setup` once.** After that, the program runs automatically and quietly in the background every time you use Claude Code, feeding information into the statusline. You'd only need to open a terminal again to:
- Change which items are shown (`setup` again)
- Check whether it's still correctly installed (`status`)
- Remove the registration (`uninstall`)

---

## 7. How to use it

### I want to change which items are shown later

**Easiest way**: Type `/claudetower-widgets` in the Claude Code chat, or just say something like "turn off context and cost in the statusline" or "slow down the refresh rate." No terminal needed — the AI shows you the current state and toggles it (or adjusts the speed) for you (this conversational command gets installed automatically whenever you run `setup`). If you just type `/claudetower-widgets` with nothing else, a check-box menu pops up (tick with your mouse or arrow keys + space) so you can pick what to change — only ticked items change, everything else stays as-is.

**If you're comfortable with a terminal**: run something like `claudetower widgets off context cost` — only the widgets you name change, everything else stays as it was (no need to re-answer all 5 `setup` questions). Widget names: `model`, `location`, `context`, `cost`, `rate_limit`. Running `claudetower widgets` alone shows you what's currently on. (If bare `claudetower` doesn't work in a new terminal, see section 9 — use the full path, or the "easiest way" above.)

**To reconfigure everything from scratch**: run `setup` again and answer the 5 questions.

### I want to check whether it's installed correctly

```
claudetower-win-x64.exe status
```
You should see something like:
```
설치 상태: 설치됨 (claudetower 상태표시줄이 Claude Code에 등록되어 있습니다)
표시 중인 항목: 사용 모델, 프로젝트 위치, 컨텍스트 사용량, 비용, 사용률(5시간/7일)
```
(Install status: installed — statusline registered with Claude Code / Widgets shown: model, location, context, cost, rate limits)

### I don't want to use it anymore

```
claudetower-win-x64.exe uninstall
```
This cleanly removes only the statusline registration from Claude Code. It never touches any of your other Claude Code settings.

### Can I delete the file I originally downloaded?

**Yes, as long as you've run `setup` at least once.** The moment you run `setup`, the program automatically copies itself to a fixed, safe location on your computer (`~/.claudetower/bin/`). After that, the file you originally downloaded can be safely deleted, renamed, or moved — it no longer matters.

---

## 8. How it works (concept)

In plain terms:

Every time you interact with Claude Code, it briefly shares your "current situation" (which folder you're working in, which model you're using, how much you've spent, etc.) with this program. The program takes that information and turns it into a "nicely formatted single line," which it hands back to Claude Code. Claude Code then displays that line at the bottom of your screen.

Think of it like having someone sit next to you whose only job is to make a little status sign — they can see where you are (your folder) and what time it is (rate-limit reset time), and they make you a sign based on that. But they never touch your wallet or ID (your account credentials).

This program **never sends anything over the internet.** All information stays entirely on your own computer.

---

## 9. Full command list

> **Note**: Typing bare `claudetower` in a freshly opened terminal may not work. During `claudetower setup`, answering Y to "make `claudetower` work as a short command in the terminal?" fixes this going forward; if you answered N, or installed an older version, it may still not work. **If you'd rather skip the terminal entirely, use the "easiest way" from section 7** (`/claudetower-widgets`, or just asking in plain language). If you still want to use a terminal, use the full path instead of bare `claudetower`: `~/.claudetower/bin/claudetower.exe` (macOS/Linux: `~/.claudetower/bin/claudetower`).

| Command | What it does | Example |
|---|---|---|
| `claudetower --version` | Shows the currently installed version number | `0.1.10` |
| `claudetower --help` (or run with no arguments) | Shows usage instructions | — |
| `claudetower setup` | Choose which widgets to show and auto-register with Claude Code (also installs the `/claudetower-widgets` chat command) | Answer 5 questions with Y/n |
| `claudetower widgets` | Check which widgets are currently on | Shows status only, changes nothing |
| `claudetower widgets off <widgets...>` / `on <widgets...>` | Turn only the named widgets on/off | `claudetower widgets off context cost` |
| `claudetower status` | Check current install status and which widgets are enabled | Shows "installed" / "not installed" / "broken" |
| `claudetower config statusline-refresh <seconds>` | Adjusts how often the statusline refreshes (default 3 seconds). If you keep several windows open at once, raising it to 5 seconds or more reduces load on your computer further. You can also just say "slow down the statusline refresh" in chat instead of using a terminal | `claudetower config statusline-refresh 5` |
| `claudetower uninstall` | Safely remove the statusline registration and the `/claudetower-widgets` chat command | Other settings are left untouched |
| `claudetower statusline` | The renderer Claude Code calls internally | **You never need to run this yourself** |
| `/claudetower-widgets` (in Claude Code chat) | Turn widgets on/off conversationally, no terminal needed | Just say "turn off context and cost" |

> Account-related commands like `accounts` **do not exist yet** (planned for Phase 2 — there is no code for them right now).

---

## 10. Workflows (typical usage flow)

**First-time installation**:
```
[1] Download the file from the Releases page
      ↓
[2] Open a terminal
      ↓
[3] Run "claudetower ... setup" → answer 5 questions
      ↓
[4] Automatically copied to a safe location + registered with Claude Code
      ↓
[5] Start a new conversation in Claude Code → see the statusline
```

**Day-to-day use**: You don't need to do anything. It shows up automatically every time you use Claude Code.

**Changing which items are shown**:
```
[1] Open a terminal (from any folder)
      ↓
[2] Run "claudetower ... setup" again → Y for what you want, n for what you don't
      ↓
[3] Takes effect from your next conversation
```

**If something goes wrong**:
```
[1] Run "claudetower ... status" to check
      ↓
[2] If it says "broken" → run "claudetower ... setup" again (auto-repairs)
      ↓
[3] Still stuck? → see Section 15, "Troubleshooting"
```

---

## 11. Version history summary

This program has been rapidly refined through real-world testing. Below is an accurate summary of what actually changed in each version (current latest **released** version: **v0.1.10**). Click any entry to expand it.

<details>
<summary><strong>v0.1.10</strong> — Percentage display fix, one-liner install stabilized (latest release)</summary>

Fixed a bug where context/rate-limit percentages outside the normal 0-100 range showed up as impossible numbers like "-10%" or "150%". Established a `main` branch so the curl/PowerShell one-liner install actually works. Added a disclaimer stating this program is not an official Anthropic product.
</details>

<details>
<summary><strong>v0.1.9</strong> — Quick widget toggle + chat-based configuration</summary>

Added `claudetower widgets on/off` for quickly toggling just the widgets you name (no need to re-answer all 5 questions). `setup` now also installs a `/claudetower-widgets` command so you can turn widgets on/off conversationally right in the Claude Code chat (no terminal needed).
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

> **Note (not yet released — in development)**: The list above only covers versions officially released on GitHub. As of this writing, the following improvements **already exist in the code but have not yet shipped in a numbered release**: `claudetower config statusline-refresh <seconds>` (adjust statusline refresh speed, also available via chat), a new default refresh speed of 3 seconds instead of 1 second for new installs (reduces load on your computer), an opt-in prompt during setup to register `claudetower` as a short PATH command, a self-healing fix so the statusline automatically restores the `/claudetower-widgets` chat command file if it ever goes missing, a confirmed root cause (and a fix) for why that file kept disappearing in the first place, and a check-box menu for `/claudetower-widgets` when run with no arguments (tick items instead of answering in plain text). These will be added to the list above with a version number once the next release ships.

---

## 12. Security & data flow

- This program **never sends anything over the internet.** Everything happens locally on your own computer.
- Your Claude account ID, password, and authentication tokens (login credentials) are **structurally inaccessible to this program** (see Section 13, "Architecture").
- The information Claude Code shares with it each time (working folder path, usage figures, etc.) is only used to render the display — it is **never stored anywhere.**
- The only file this program actually saves to your computer is a small list of "which items to show" (e.g., whether to display context usage) — and that file never contains any personal or account information.

---

## 13. Architecture

**In plain terms**: this program is designed as two completely separate rooms.

- **The "statusline room"**: this is the part that's actually working right now. It only displays information on screen, so it's always safe.
- **The "account-switching room"**: this **hasn't even been built yet** (no code exists for it). Once it is built, it's designed to be a completely separate room whose key won't open the statusline room's door.

The reason for this separation is so that, even after the "account switching" feature is eventually added, any issues with that feature stay isolated — the "statusline" feature will keep working safely regardless. Whether this separation actually holds is automatically checked by tooling every time the program is built.

---

## 14. File & document locations

Here's where this program actually creates or uses files on your computer.

| File/folder | Location (Windows example) | What is it? |
|---|---|---|
| Installed executable | `C:\Users\YourName\.claudetower\bin\claudetower.exe` | The file `setup` automatically copies itself to — this is the actual "real" program |
| Widget settings | `C:\Users\YourName\.claudetower\config.json` | A small file storing which items to display |
| Claude Code global settings | `C:\Users\YourName\.claude\settings.json` | Claude Code's own settings file. This program only uses the "statusLine" portion of it and never touches anything else in this file |
| Settings backup | `C:\Users\YourName\.claude\settings.json.bak` | An automatic backup of your settings taken right before any change — useful if something goes wrong |

> On macOS/Linux, replace `C:\Users\YourName` with `~` (your home folder, usually `/Users/YourName` or `/home/YourName`).

**For developers**: detailed design rationale and decision history are kept in the `.PRD/` folder in the repository (regular users don't need to look at this).

---

## 15. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| **404 error** on the Releases page | Double-check that you typed the URL correctly. |
| **"Run anyway" button doesn't appear** on the blue warning | You need to click "More info" first — the button appears below it. |
| **Window closes instantly after double-clicking** | Not a malfunction — running with no arguments just shows help text and exits. See Section 6 and use a terminal instead. |
| `status` says **"registered but the executable can't be found (broken)"** | You accidentally deleted the installed file. Run `setup` again to repair it automatically. |
| **Ran `setup` to install a new version, but nothing changed** (e.g. version number stays the same) | Since v0.1.8, this retries automatically a few times, but antivirus scanning or similar can occasionally take even longer. Close Claude Code briefly and run `setup` again — with nothing actively using the file, the swap will go through reliably. |
| **Statusline doesn't show up** in Claude Code | Settings apply starting from your *next* interaction. Try interacting with Claude Code once more. |
| `/claudetower-widgets` (chat-based widget toggle) **used to work but suddenly doesn't** | Root cause confirmed — this program's own automated verification routine had a bug that could delete the real config file by mistake (not something you did). A guard against recurrence and a self-healing fix (recreates it within seconds if it ever goes missing) have both been applied, pending the next release. If you hit this on the current version, run `claudetower setup` once more to fix it immediately. |
| **Context percentage looks off or empty** | This can happen briefly at the start of a session or right after `/compact`. This is expected, normal Claude Code behavior. |
| For developers — `npm run build` fails | Check that `node --version` is 22 or later. |

**Still stuck?** Take a screenshot of the output of `claudetower status` and share it when asking for help — it makes diagnosing the issue much faster.

---

## 16. Frequently asked questions (FAQ)

**Q. Does installing this collect my Claude account information?**
A. No. Account-related code isn't included in this version (v0.1.10) at all. This program is structurally unable to see or store your ID, password, or authentication tokens.

**Q. Does anything get sent over the internet?**
A. No. Everything runs locally, entirely on your own computer.

**Q. Will account switching turn on automatically once it's built?**
A. No. That feature will require your explicit, deliberate consent before it can ever be enabled, and the statusline will keep working fine even if you never turn it on.

**Q. Does it cost money?**
A. No, this program itself is free. Note that the "cost ($)" figure it *displays* is a separate thing — that's the cost of using Claude Code (the AI) itself, unrelated to this program.

**Q. Is it really okay to delete the file I originally downloaded?**
A. Yes, as long as you've run `setup` at least once. See Section 7.

**Q. Why does the name say "working title"?**
A. The final product name hasn't been decided yet (trademark review is still pending). We'll announce it once it's finalized.

**Q. Can I use this at my company?**
A. It's designed for personal use and is not intended for commercial sale or delivery to a company. Please read Section 17 below carefully.

---

## 17. Legal, copyright, license & commercial use

> ⚠️ **This section is not legal advice.** It describes this project's current status honestly and as-is, clearly distinguishing between confirmed facts and matters that are still undecided. If you need a legally significant determination, please consult a qualified professional such as a lawyer.

### 17-1. This program's relationship with Anthropic (very important)

**This program is not made or officially endorsed by Anthropic** (the company that makes Claude and Claude Code). It is an independent companion tool built by an individual developer, with no affiliation, sponsorship, or partnership with Anthropic whatsoever. The word "Claude" appears in this document and in the program's description solely to describe the fact that this program works alongside Claude Code — it does not mean Anthropic created, endorses, or is responsible for this program. We state this clearly to avoid any misunderstanding.

### 17-2. License (confirmed facts)

- This project uses the **Apache License 2.0**, a widely used open-source license that allows the source code to be freely viewed, modified, and redistributed, with an explicit patent grant (unlike MIT).
- The copyright holder is **SoDam AI Studio**.
- The full license text is in the [`LICENSE`](./LICENSE) file in the repository.

### 17-3. License (not yet finalized — stated honestly)

- The final product name has not been decided yet (trademark review regarding candidate names is still in progress). Until the name is finalized, the `npm install -g` distribution channel is also deliberately not being opened (an npm package name is effectively permanent once claimed).

### 17-4. Commercial use — strict prohibition

**The current version of this program (v0.1.10, Phase 1 MVP) is not designed for:**

- ❌ Commercial sale
- ❌ Being offered as a paid service
- ❌ Paid delivery to a company or organization

**This program is distributed for free, personal use only.**

Reason for this strict limitation: there are plans to eventually add an "automatic multi-account switching" feature (the Account module), which would cycle between multiple Claude accounts automatically — a pattern that **could conflict with Claude's terms of service.** It has been clearly established that once this feature actually ships, that risk applies to the entire program, even for users who never turn the feature on and only use the statusline. To avoid amplifying that risk through commercial expansion, the design principle from the very beginning excludes commercial use entirely.

> Note: as of this writing (v0.1.10), the "account switching" feature has no code at all, so the terms-of-service conflict risk described above **does not actually exist yet.** However, the commercial-use prohibition itself applies to the entire project from the start, as a matter of design principle.

### 17-5. On reusing external code and ideas

While designing this project, several other open-source statusline/account-management tools were referenced (e.g., ccstatusline, starship-claude, teamclaude, claude-swap, and others). However, **this project did not copy their source code — only design ideas and patterns were referenced.** If any actual code is borrowed in the future, the attribution requirements of the original project's license will be followed (this has not yet been fully reviewed legally).

### 17-6. Limitation of liability

This program is provided **"AS IS"** under the standard terms of the Apache License 2.0, without any warranty of any kind, express or implied. The copyright holder (SoDam AI Studio) is not liable for any damages arising from the use of this program (see the [`LICENSE`](./LICENSE) file for the exact legal text).

---

*This document covers ClaudeTower v0.1.10 and is an extended companion to [`README.en.md`](./README.en.md). The Korean version is [`GUIDE.md`](./GUIDE.md).*
