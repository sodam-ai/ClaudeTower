# ClaudeTower (working title)

[한국어](./README.md) | [English](./README.en.md)

## What is this? (one-line explanation for beginners)

A statusline tool for Claude Code that shows what's happening right now at the bottom of your screen (context usage, cost, current project path). Multi-account auto-switching is planned for later, but that feature will never turn on until its safety gate (explicit user consent) is fully built.

## Current status (important)

This project is still in **Phase 1 (first milestone)**. There is no installable release for end users yet — right now, this is source code that developers build and test directly.

- Done: CLI skeleton (`claudetower --version`/`--help`), single-executable (SEA) build pipeline, Display/Account module code isolation with automated verification
- Not yet: actual statusline widgets, the `setup` configuration wizard, end-user install scripts

## Prerequisites

- [Node.js](https://nodejs.org) 22 or later (only needed for development/building right now — the final release is designed to run without Node.js installed)
- Git

## 1. Clone the repository

```bash
git clone <repository URL>
cd ClaudeTower
```

## 2. Install development tools

```bash
npm install
```

This fetches development tooling (the ESLint linter, the esbuild bundler, etc.). Requires an internet connection.

## 3. Try running it

```bash
node bin/claudetower.js --help
node bin/claudetower.js --version
```

## 4. Run the tests

```bash
npm test
```

To run everything at once (style check + module-boundary security check + tests):

```bash
npm run verify
```

## 5. Build a distributable executable

```bash
npm run build
```

This produces one executable in `dist/` matching your OS (e.g. `claudetower-win-x64.exe` on Windows). That executable runs as-is even on a machine without Node.js installed.

## Common issues

- **`npm install` fails**: Check your internet connection and Node.js installation (`node --version`).
- **`npm run build` fails**: This usually means your Node.js version is below 22.
- **Windows shows a warning when running the built executable**: The binary isn't code-signed yet, so Windows may show an "unknown publisher" warning. Click "More info" then "Run anyway" — this is expected before an official signed release.

## Security & architecture notes

- This program is split into two parts: the **statusline part** (always safe, never touches credentials) and the **account-switching part** (no code exists yet; will only be added and enabled after an explicit consent flow).
- The two parts are prevented from reaching into each other at the code level, and this is checked automatically every time (ESLint rule + independent verification script + a runtime test) via `npm run verify`.
- For full design rationale and security requirements, see the docs in [`.PRD/`](./.PRD/).

## License

MIT — see [`LICENSE`](./LICENSE) (the copyright holder name is not finalized yet).
