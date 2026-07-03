'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderModel } = require('../../src/display/widgets/model');

test('model.display_name이 있으면 접두어 없이 이름만 그대로 표시된다', () => {
  assert.equal(renderModel({ model: { display_name: 'Opus' } }), 'Opus');
});

test('model 필드 자체가 없으면 위젯이 숨겨진다', () => {
  assert.equal(renderModel({}), null);
});

test('model.display_name이 문자열이 아니면(숫자·객체 등) 숨겨진다', () => {
  assert.equal(renderModel({ model: { display_name: 123 } }), null);
  assert.equal(renderModel({ model: { display_name: {} } }), null);
  assert.equal(renderModel({ model: { display_name: null } }), null);
});

test('display_name이 공백뿐이면 숨겨진다', () => {
  assert.equal(renderModel({ model: { display_name: '   ' } }), null);
});

test('앞뒤 공백은 트리밍된다', () => {
  assert.equal(renderModel({ model: { display_name: '  Sonnet  ' } }), 'Sonnet');
});
