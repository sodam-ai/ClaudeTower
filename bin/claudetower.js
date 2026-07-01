#!/usr/bin/env node
'use strict';

const { CLI_NAME } = require('../src/shared/constants');
const pkg = require('../package.json');

function run(args) {
  if (args.includes('--version') || args.includes('-v')) {
    console.log(pkg.version);
    return 0;
  }

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`${CLI_NAME} — Claude Code statusline + account switching CLI`);
    console.log('Usage: claudetower <command>');
    console.log('Commands: (Phase 1에서 구현 예정 — setup)');
    return 0;
  }

  console.error(`Unknown command: ${args[0]}`);
  return 1;
}

// require()로 로드될 때(예: 테스트)는 실행하지 않고, 직접 실행될 때만 CLI로 동작.
if (require.main === module) {
  process.exit(run(process.argv.slice(2)));
}

module.exports = { run };
