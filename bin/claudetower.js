#!/usr/bin/env node
'use strict';

const readline = require('node:readline');
const { CLI_NAME } = require('../src/shared/constants');
const pkg = require('../package.json');

async function run(args) {
  if (args.includes('--version') || args.includes('-v')) {
    console.log(pkg.version);
    return 0;
  }

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`${CLI_NAME} — Claude Code statusline + account switching CLI`);
    console.log('Usage: claudetower <command>');
    console.log('Commands: setup, statusline');
    return 0;
  }

  const command = args[0];

  if (command === 'setup') {
    const { runSetupWizard } = require('../src/display/setup-wizard');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      await runSetupWizard(rl, { log: (msg) => console.log(msg) });
      return 0;
    } catch (err) {
      console.error(`setup 실패: ${err.message}`);
      return 1;
    } finally {
      rl.close();
    }
  }

  if (command === 'statusline') {
    const { render, readStdinJson } = require('../src/display/statusline');
    const session = readStdinJson();
    process.stdout.write(render(session));
    return 0;
  }

  console.error(`Unknown command: ${command}`);
  return 1;
}

// require()로 로드될 때(예: 테스트)는 실행하지 않고, 직접 실행될 때만 CLI로 동작.
if (require.main === module) {
  run(process.argv.slice(2)).then((code) => process.exit(code));
}

module.exports = { run };
