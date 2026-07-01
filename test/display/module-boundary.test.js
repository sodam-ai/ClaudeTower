'use strict';

// 모듈 경계 강제(3/3중 방어: 런타임 증명) — .PRD/02_DATA_MODEL.md
// "코드가 로드조차 되지 않는 수준의 격리"를 정적 분석이 아니라 실제 실행으로 증명한다.
//
// 주의: Phase 1 시점엔 src/display/ 안에 실제 로직이 아직 없다(Step 6에서 추가 예정).
// 지금 존재하는 Display 쪽 진입점(bin/claudetower.js, src/shared/*)만 로드해 검증하고,
// Step 6에서 src/display/ 실 코드가 생기면 그 진입점도 이 테스트에 추가해야 한다.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// "accounts" 디렉터리 세그먼트만 매칭 — "active-account-handle"(singular, 다른 디렉터리)과 혼동 방지
const ACCOUNTS_DIR_SEGMENT = /[\\/]src[\\/]accounts[\\/]/;

test('bin/claudetower.js 로드 시 src/accounts/ 가 require 캐시에 없다', () => {
  require(path.join(__dirname, '..', '..', 'bin', 'claudetower.js'));

  const loadedAccountsModules = Object.keys(require.cache).filter((p) =>
    ACCOUNTS_DIR_SEGMENT.test(p)
  );

  assert.deepEqual(
    loadedAccountsModules,
    [],
    `src/accounts/ 하위 모듈이 로드됨(모듈 경계 위반): ${loadedAccountsModules.join(', ')}`
  );
});

test('active-account-handle/read.js 로드 시에도 src/accounts/ 가 require 캐시에 없다', () => {
  require(path.join(__dirname, '..', '..', 'src', 'shared', 'active-account-handle', 'read.js'));

  const loadedAccountsModules = Object.keys(require.cache).filter((p) =>
    ACCOUNTS_DIR_SEGMENT.test(p)
  );

  assert.deepEqual(
    loadedAccountsModules,
    [],
    `src/accounts/ 하위 모듈이 로드됨(모듈 경계 위반): ${loadedAccountsModules.join(', ')}`
  );
});
