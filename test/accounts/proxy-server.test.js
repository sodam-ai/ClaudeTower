'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startProxyServer, stopProxyServer, verifyLocalAccessToken } = require('../../src/accounts/proxy/server');

test('proxy 서버 인터페이스: 세 함수 모두 아직 미구현이라 명시적으로 throw한다(M6 게이트 증명)', () => {
  assert.throws(() => startProxyServer({}), /Phase 2 게이트 대기/);
  assert.throws(() => stopProxyServer({}), /Phase 2 게이트 대기/);
  assert.throws(() => verifyLocalAccessToken('a', 'b'), /Phase 2 게이트 대기/);
});
