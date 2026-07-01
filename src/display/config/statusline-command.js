'use strict';

// settings.json의 statusLine.command에 쓸 문자열을 만든다.
// 실측 확인(node:sea): SEA 바이너리 안에서는 isSea()===true이고 process.execPath가
// 바이너리 자기 자신을 가리킨다. 개발 모드(plain node)에서는 isSea()===false이고
// process.execPath는 시스템 node.exe라서 bin/claudetower.js 경로를 추가로 붙여야 한다.
// Windows에서 Git Bash가 백슬래시를 이스케이프 문자로 오인해 경로가 조용히 깨지는 문제가
// 공식 문서에 실려 있어(RESEARCH_SOURCES.md 983행), 항상 슬래시로 정규화한다.

const path = require('node:path');
const sea = require('node:sea');

function toForwardSlash(p) {
  return p.replace(/\\/g, '/');
}

function buildStatuslineCommand() {
  const execPath = toForwardSlash(process.execPath);
  if (sea.isSea()) {
    return `${execPath} statusline`;
  }
  const binPath = toForwardSlash(path.join(__dirname, '..', '..', '..', 'bin', 'claudetower.js'));
  return `${execPath} ${binPath} statusline`;
}

module.exports = { buildStatuslineCommand, toForwardSlash };
