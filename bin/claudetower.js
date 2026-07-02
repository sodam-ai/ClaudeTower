#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
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
    console.log('Commands: setup, statusline, status, uninstall');
    // 인자 없이 실행된 경우(대표적으로 exe 더블클릭)는 Windows가 새 콘솔 창을 열고,
    // 프로세스가 끝나자마자 그 창도 함께 닫혀버려 사용자가 위 안내를 읽을 새도 없이
    // 창이 사라진다("켜졌다 바로 꺼짐" 버그 리포트로 발견). stdin/stdout이 둘 다
    // 실제 터미널(TTY)일 때만 키 입력을 기다려 창이 즉시 닫히지 않게 한다 — 파이프
    // 입력이나 CI 스모크테스트(비대화형)에서는 TTY가 아니므로 이 대기가 걸리지 않는다.
    if (args.length === 0 && process.stdin.isTTY && process.stdout.isTTY) {
      console.log('\n아무 키나 누르면 창이 닫힙니다...');
      await new Promise((resolve) => {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.once('data', resolve);
      });
    }
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

  if (command === 'status') {
    // "설치 여부를 확실히 알 수 있게" — setup/uninstall을 실행한 세션이 끝난 뒤에도
    // 언제든 나중에 조회 가능한 읽기 전용 명령. 실사용 피드백으로 추가.
    const { getInstallStatus } = require('../src/display/config/status');
    const { WIDGET_LABELS } = require('../src/display/setup-wizard');
    try {
      const status = getInstallStatus();
      if (status.installed) {
        console.log('설치 상태: 설치됨 (claudetower 상태표시줄이 Claude Code에 등록되어 있습니다)');
        console.log(`표시 중인 항목: ${status.enabledWidgets.map((t) => WIDGET_LABELS[t] || t).join(', ')}`);
        console.log(`등록된 명령: ${status.command}`);
        console.log(`설정 파일: ${status.settingsPath}`);
      } else if (status.foreign) {
        console.log('설치 상태: claudetower가 등록한 것이 아닌 다른 상태표시줄이 등록되어 있습니다.');
        console.log(`등록된 명령: ${status.command}`);
        console.log('claudetower setup을 실행하면 이 설정을 덮어씁니다.');
      } else {
        console.log('설치 상태: 설치 안 됨 (claudetower 상태표시줄이 등록되어 있지 않습니다)');
        console.log('claudetower setup을 실행하면 설치됩니다.');
      }
      return 0;
    } catch (err) {
      console.error(`상태 확인 실패: ${err.message}`);
      return 1;
    }
  }

  if (command === 'uninstall') {
    // setup 반대 방향 — "제거하려면 settings.json을 손으로 고쳐야 해서 다른 설정까지
    // 실수로 지울 위험이 있다"는 실사용 피드백으로 추가. statusLine 키만 안전하게
    // 제거하고 hooks/권한 등 나머지 설정은 절대 건드리지 않는다.
    const { removeStatusLineConfig } = require('../src/display/config/settings-writer');
    const { resolveWidgetConfigPath } = require('../src/display/config/widget-config');
    const { getInstallStatus } = require('../src/display/config/status');

    const result = removeStatusLineConfig();
    if (result.removed) {
      console.log(`상태표시줄 설정을 제거했습니다: ${result.filePath}`);
      if (result.backedUp) {
        console.log(`(제거 전 설정은 ${result.filePath}.bak 으로 백업해뒀습니다)`);
      }
    } else {
      console.log('등록된 상태표시줄 설정이 없어 제거할 것이 없습니다.');
    }

    const widgetConfigPath = resolveWidgetConfigPath();
    if (fs.existsSync(widgetConfigPath)) {
      fs.unlinkSync(widgetConfigPath);
      console.log(`위젯 설정 파일도 삭제했습니다: ${widgetConfigPath}`);
    }

    // "제거 여부를 확실히 알 수 있게" — 지우고 끝내는 대신, 설정 파일을 다시 읽어서
    // 정말로 남은 게 없는지 재확인하고 그 결과를 명시적으로 알린다(Account 모듈의
    // "삭제 완전성 검증" 원칙과 동일한 정신, .PRD/04_PROJECT_SPEC.md 86행 참고).
    const verifyStatus = getInstallStatus();
    if (verifyStatus.installed) {
      console.error('\n확인 실패: 제거를 시도했지만 설정 파일에 claudetower 상태표시줄이 여전히 남아있습니다.');
      return 1;
    }
    console.log('\n확인 완료: claudetower 상태표시줄이 완전히 제거됐습니다.');
    console.log('claudetower 실행 파일(.exe)은 직접 삭제하시면 됩니다.');
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
