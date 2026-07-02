'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStatuslineCommand, toForwardSlash } = require('../../src/display/config/statusline-command');

test('toForwardSlash는 백슬래시를 슬래시로 변환한다(Windows Git Bash 백슬래시 이스케이프 버그 회피)', () => {
  assert.equal(toForwardSlash('C:\\Users\\name\\project'), 'C:/Users/name/project');
});

test('toForwardSlash는 이미 슬래시인 경로를 그대로 둔다', () => {
  assert.equal(toForwardSlash('/already/forward'), '/already/forward');
});

test('toForwardSlash는 빈 문자열을 그대로 반환한다', () => {
  assert.equal(toForwardSlash(''), '');
});

test('개발 모드(plain node)에서 만든 command에는 백슬래시가 전혀 없다', () => {
  const command = buildStatuslineCommand();
  assert.equal(command.includes('\\'), false);
});

test('command는 항상 statusline 서브커맨드로 끝난다', () => {
  assert.ok(buildStatuslineCommand().endsWith('statusline'));
});

test('연속 호출해도 매번 동일한 값을 반환한다(부수효과 없음)', () => {
  assert.equal(buildStatuslineCommand(), buildStatuslineCommand());
});

test('경로가 따옴표로 감싸져 있다(사용자 계정 이름에 공백이 있어도 셸이 쪼개지 않도록)', () => {
  const command = buildStatuslineCommand();
  assert.match(command, /^"/);
});
