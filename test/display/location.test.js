'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderLocation } = require('../../src/display/widgets/location');

test('workspace.current_dir이 있으면 폴더명만 아이콘과 함께 표시된다', () => {
  assert.equal(renderLocation({ workspace: { current_dir: '/home/user/my-project' } }), '📁 my-project');
});

test('workspace.current_dir이 없으면 cwd로 대체된다(하위 호환)', () => {
  assert.equal(renderLocation({ cwd: '/home/user/legacy-project' }), '📁 legacy-project');
});

test('current_dir/cwd가 둘 다 없으면 위젯이 숨겨진다', () => {
  assert.equal(renderLocation({}), null);
});

test('문자열이 아니면(숫자·객체 등) 숨겨진다', () => {
  assert.equal(renderLocation({ cwd: 123 }), null);
  assert.equal(renderLocation({ cwd: null }), null);
});

test('앞뒤 공백은 트리밍 후 표시된다', () => {
  assert.equal(renderLocation({ cwd: '  /home/user/proj  ' }), '📁 proj');
});

test('경로 구분자가 없는 거대 값도 80자 이내로 잘린다(2026-07-11 실측 발견 — 50만자가 그대로 출력되던 결함)', () => {
  const huge = 'X'.repeat(500000);
  const result = renderLocation({ cwd: huge });
  // "📁 " 접두어(아이콘+공백) 제외한 폴더명 부분이 80자 이내여야 한다
  const dirPart = result.slice('📁 '.length);
  assert.equal(dirPart.length, 80);
  assert.ok(dirPart.endsWith('…'));
});

test('경로 구분자가 있어도 마지막 세그먼트 자체가 거대하면 80자 이내로 잘린다', () => {
  const huge = 'X'.repeat(500000);
  const result = renderLocation({ cwd: '/a/b/' + huge });
  const dirPart = result.slice('📁 '.length);
  assert.equal(dirPart.length, 80);
  assert.ok(dirPart.endsWith('…'));
});
