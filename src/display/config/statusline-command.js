'use strict';

// settings.json의 statusLine.command에 쓸 문자열을 만든다.
// 실측 확인(node:sea): SEA 바이너리 안에서는 isSea()===true이고 process.execPath가
// 바이너리 자기 자신을 가리킨다. 개발 모드(plain node)에서는 isSea()===false이고
// process.execPath는 시스템 node.exe라서 bin/claudetower.js 경로를 추가로 붙여야 한다.
// Windows에서 Git Bash가 백슬래시를 이스케이프 문자로 오인해 경로가 조용히 깨지는 문제가
// 공식 문서에 실려 있어(RESEARCH_SOURCES.md 983행), 항상 슬래시로 정규화한다.
//
// SEA일 때는 "지금 실행 중인 파일의 위치"가 아니라 install-target.js가 정한 고정
// 설치 위치(~/.claudetower/bin/claudetower(.exe))를 등록한다 — 사용자가 다운로드한
// exe를 나중에 지우거나 옮겨도 등록이 안 깨지게 하기 위함(실사용 중 발견된 문제의
// 근본 해결책, ensureInstalledAtTarget이 그 고정 위치로 자기 복사를 담당).
// 경로를 항상 따옴표로 감싸는 이유: 사용자 계정 이름에 공백이 있으면(예: "John Smith")
// 따옴표 없는 경로는 셸이 여러 인자로 쪼개버려 명령 자체가 깨진다.

const fs = require('node:fs');
const path = require('node:path');
const sea = require('node:sea');
const { resolveInstallTargetPath } = require('./install-target');

function toForwardSlash(p) {
  return p.replace(/\\/g, '/');
}

function quote(p) {
  return `"${p}"`;
}

function buildStatuslineCommand() {
  if (sea.isSea()) {
    const targetPath = resolveInstallTargetPath();
    // 고정 위치에 파일이 실제로 있을 때만 그 경로를 등록한다. ensureInstalledAtTarget의
    // 복사가 실패했다면(예: Windows 파일 잠금 충돌) 존재하지도 않는 경로를 등록해서
    // "즉시 고장난 상태"로 만드는 것보다, 지금 실제로 실행 중인 파일(반드시 존재함)의
    // 위치를 등록하는 게 훨씬 안전하다 — 그 경우 이전과 동일한 수준의 위험만 남는다.
    const usablePath = fs.existsSync(targetPath) ? targetPath : process.execPath;
    return `${quote(toForwardSlash(usablePath))} statusline`;
  }
  const execPath = toForwardSlash(process.execPath);
  const binPath = toForwardSlash(path.join(__dirname, '..', '..', '..', 'bin', 'claudetower.js'));
  return `${quote(execPath)} ${quote(binPath)} statusline`;
}

module.exports = { buildStatuslineCommand, toForwardSlash };
