'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveCacheDir, isSafeSessionId, readCachedValue, writeCachedValue } = require('../../src/display/cache/file-cache');

function tempCacheDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-cache-test-'));
}

test('resolveCacheDir: CLAUDETOWER_CACHE_DIR가 설정되면 그 값을 그대로 쓴다', () => {
  const original = process.env.CLAUDETOWER_CACHE_DIR;
  process.env.CLAUDETOWER_CACHE_DIR = '/tmp/fake-cache-dir';
  try {
    assert.equal(resolveCacheDir(), '/tmp/fake-cache-dir');
  } finally {
    if (original === undefined) delete process.env.CLAUDETOWER_CACHE_DIR;
    else process.env.CLAUDETOWER_CACHE_DIR = original;
  }
});

test('isSafeSessionId: 영숫자/-/_ 만 안전으로 판정한다', () => {
  assert.equal(isSafeSessionId('abc123'), true);
  assert.equal(isSafeSessionId('abc-123_XYZ'), true);
  assert.equal(isSafeSessionId(''), false);
  assert.equal(isSafeSessionId(null), false);
  assert.equal(isSafeSessionId(undefined), false);
  assert.equal(isSafeSessionId(123), false);
});

test('isSafeSessionId: 경로 조작 시도(../ 등)는 안전하지 않다고 판정한다(핵심 보안 요구사항)', () => {
  assert.equal(isSafeSessionId('../../../etc/passwd'), false);
  assert.equal(isSafeSessionId('..\\..\\windows\\system32'), false);
  assert.equal(isSafeSessionId('a/b'), false);
  assert.equal(isSafeSessionId('a b'), false);
});

test('readCachedValue: 캐시 파일이 없으면 null(에러 아님)', () => {
  const cacheDir = tempCacheDir();
  assert.equal(readCachedValue({ sessionId: 'sess-1', key: 'git_status', cacheDir }), null);
});

test('write→read 왕복: 방금 쓴 값을 그대로 읽어온다(TTL 안 지남)', () => {
  const cacheDir = tempCacheDir();
  writeCachedValue({ sessionId: 'sess-1', key: 'git_status', value: 'main|1|2', ttlSec: 5, cacheDir });
  assert.equal(readCachedValue({ sessionId: 'sess-1', key: 'git_status', cacheDir }), 'main|1|2');
});

test('readCachedValue: TTL이 지나면 null을 반환한다(만료 처리)', () => {
  const cacheDir = tempCacheDir();
  fs.mkdirSync(cacheDir, { recursive: true });
  const filePath = path.join(cacheDir, 'sess-1__git_status.json');
  const staleEntry = {
    session_id: 'sess-1',
    key: 'git_status',
    value: 'main|0|0',
    cached_at: new Date(Date.now() - 10_000).toISOString(), // 10초 전
    ttl_sec: 5,
  };
  fs.writeFileSync(filePath, JSON.stringify(staleEntry), 'utf8');
  assert.equal(readCachedValue({ sessionId: 'sess-1', key: 'git_status', cacheDir }), null);
});

test('readCachedValue: 손상된 JSON이어도 예외 없이 null을 반환한다', () => {
  const cacheDir = tempCacheDir();
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, 'sess-1__git_status.json'), 'NOT-VALID-JSON{{{', 'utf8');
  assert.doesNotThrow(() => {
    assert.equal(readCachedValue({ sessionId: 'sess-1', key: 'git_status', cacheDir }), null);
  });
});

test('readCachedValue/writeCachedValue: 안전하지 않은 session_id는 조용히 무시한다(경로 조작 방지, 파일 미생성)', () => {
  const cacheDir = tempCacheDir();
  writeCachedValue({ sessionId: '../../evil', key: 'git_status', value: 'x|0|0', ttlSec: 5, cacheDir });
  const entries = fs.readdirSync(cacheDir);
  assert.deepEqual(entries, []); // 캐시 디렉터리 안에 아무 파일도 생기지 않았어야 함
  assert.equal(readCachedValue({ sessionId: '../../evil', key: 'git_status', cacheDir }), null);
});

test('writeCachedValue: 서로 다른 session_id/key는 서로 다른 캐시 항목으로 분리 저장된다', () => {
  const cacheDir = tempCacheDir();
  writeCachedValue({ sessionId: 'sess-A', key: 'git_status', value: 'a|0|0', ttlSec: 5, cacheDir });
  writeCachedValue({ sessionId: 'sess-B', key: 'git_status', value: 'b|1|1', ttlSec: 5, cacheDir });
  assert.equal(readCachedValue({ sessionId: 'sess-A', key: 'git_status', cacheDir }), 'a|0|0');
  assert.equal(readCachedValue({ sessionId: 'sess-B', key: 'git_status', cacheDir }), 'b|1|1');
});

test('writeCachedValue: 부분 격리 상태(다른 CLAUDETOWER_* 변수만 설정)에서도 예외를 던지지 않는다(2026-08-03 라이브 테스트로 발견한 결함의 회귀 테스트 — 예전엔 이 예외가 renderGit까지 새어나가 정상 조회한 값까지 함께 버려졌음)', () => {
  const original = process.env.CLAUDETOWER_WIDGET_CONFIG_PATH;
  process.env.CLAUDETOWER_WIDGET_CONFIG_PATH = '/tmp/fake-widget-config.json'; // CLAUDETOWER_CACHE_DIR는 일부러 안 줌 -> 부분 격리
  try {
    assert.doesNotThrow(() => {
      writeCachedValue({ sessionId: 'sess-partial-isolation', key: 'git_status', value: 'main|0|0', ttlSec: 5 });
    });
  } finally {
    if (original === undefined) delete process.env.CLAUDETOWER_WIDGET_CONFIG_PATH;
    else process.env.CLAUDETOWER_WIDGET_CONFIG_PATH = original;
  }
});

test('writeCachedValue: 캐시 파일에 소유자 전용 권한(mode 0o600)으로 쓰기를 시도한다(POSIX에서 실제로 제한, Windows는 기존 rotation-log.js와 동일한 한계)', () => {
  const cacheDir = tempCacheDir();
  writeCachedValue({ sessionId: 'sess-1', key: 'git_status', value: 'main|0|0', ttlSec: 5, cacheDir });
  const filePath = path.join(cacheDir, 'sess-1__git_status.json');
  assert.equal(fs.existsSync(filePath), true);
  if (process.platform !== 'win32') {
    const mode = fs.statSync(filePath).mode & 0o777;
    assert.equal(mode, 0o600);
  }
});
