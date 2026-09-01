'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { renderActiveAccount } = require('../../src/display/widgets/active-account');

function tempHandlePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-active-account-widget-test-'));
  return path.join(dir, 'active-account.json');
}

function writeHandle(filePath, fields) {
  fs.writeFileSync(filePath, JSON.stringify(fields));
}

test('핸들 파일이 없으면 위젯이 숨겨진다(Account 모듈 미사용 — 01_PRD.md §5 성공 기준)', () => {
  const filePath = tempHandlePath(); // 만들지 않음
  assert.equal(renderActiveAccount({}, { filePath }), null);
});

test('핸들 파일이 있으면 라벨이 사람 아이콘 접두어와 함께 표시된다', () => {
  const filePath = tempHandlePath();
  writeHandle(filePath, { account_label: '업무용', updated_at: '2026-08-31T00:00:00.000Z' });
  assert.equal(renderActiveAccount({}, { filePath }), '👤 업무용');
});

test('session 인자와 무관하게 동작한다(값이 stdin이 아니라 파일에서만 옴)', () => {
  const filePath = tempHandlePath();
  writeHandle(filePath, { account_label: '개인용', updated_at: '2026-08-31T00:00:00.000Z' });
  assert.equal(renderActiveAccount({ model: { display_name: 'Opus' } }, { filePath }), '👤 개인용');
  assert.equal(renderActiveAccount(null, { filePath }), '👤 개인용');
  assert.equal(renderActiveAccount(undefined, { filePath }), '👤 개인용');
});

test('앞뒤 공백은 트리밍된다', () => {
  const filePath = tempHandlePath();
  writeHandle(filePath, { account_label: '  회사  ', updated_at: '2026-08-31T00:00:00.000Z' });
  assert.equal(renderActiveAccount({}, { filePath }), '👤 회사');
});

test('라벨이 공백뿐이면 숨겨진다(read.js는 파싱만 담당, 렌더 단계에서 방어)', () => {
  const filePath = tempHandlePath();
  writeHandle(filePath, { account_label: '   ', updated_at: '2026-08-31T00:00:00.000Z' });
  assert.equal(renderActiveAccount({}, { filePath }), null);
});

test('80자를 넘으면 잘리고 말줄임표(…)가 붙는다(model.js와 동일한 text-safety 정책)', () => {
  const filePath = tempHandlePath();
  const huge = 'X'.repeat(500);
  writeHandle(filePath, { account_label: huge, updated_at: '2026-08-31T00:00:00.000Z' });
  const result = renderActiveAccount({}, { filePath });
  // "👤 " 접두어 다음에 truncateForDisplay가 적용된 80자가 붙는다. 접두어 길이는
  // 하드코딩하지 않는다 — 👤(U+1F464)는 BMP 밖 문자라 JS 문자열 length가 서로게이트
  // 쌍(2)으로 세어, "2글자+공백=2"로 단순 가정하면 실제로는 3이 되어 어긋난다(직접
  // 실행해 83!==82로 발견한 실제 결함, model.js/location.js/git.js와 동일한 함정).
  assert.equal(result.length, '👤 '.length + 80);
  assert.ok(result.endsWith('…'));
});

test('손상된 JSON이어도 크래시하지 않고 숨겨진다(read.js가 이미 null로 폴백, 위젯이 그대로 통과)', () => {
  const filePath = tempHandlePath();
  fs.writeFileSync(filePath, '{invalid json,,,');
  assert.doesNotThrow(() => renderActiveAccount({}, { filePath }));
  assert.equal(renderActiveAccount({}, { filePath }), null);
});

test('account_label 필드가 없거나 문자열이 아니면 숨겨진다', () => {
  const filePath = tempHandlePath();
  writeHandle(filePath, { updated_at: '2026-08-31T00:00:00.000Z' }); // account_label 자체가 없음
  assert.equal(renderActiveAccount({}, { filePath }), null);
});
