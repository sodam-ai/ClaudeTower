'use strict';

// Display 모듈의 파일 기반 캐시(.PRD/02_DATA_MODEL.md CacheEntry, Phase 3).
// git 상태처럼 조회가 느린 값을 짧게 저장해 두는 용도 — 공식 문서 권장대로 프로세스
// ID가 아니라 session_id를 키로 쓴다(DO NOT 규칙: 캐시 키에 PID를 쓰지 마, 매 호출마다
// 캐시가 무효화됨).
//
// session_id는 stdin(신뢰하지 않는 입력)에서 온다 — 파일 경로에 그대로 이어붙이면
// 경로 조작(예: session_id: "../../../etc/passwd")에 노출된다. 그래서 안전한 형식
// (영숫자/-/_)만 허용하고, 그 외는 캐시를 아예 쓰지 않는다 — "캐시 없이 매번 새로
// 조회"가 "위험한 값으로 파일 경로를 구성"보다 항상 더 안전한 폴백이다.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { CONFIG_DIR_NAME } = require('../../shared/constants');
const { assertNotPartialIsolation } = require('../config/test-isolation');

const SAFE_SESSION_ID = /^[A-Za-z0-9_-]+$/;

function resolveCacheDir() {
  return process.env.CLAUDETOWER_CACHE_DIR || path.join(os.homedir(), CONFIG_DIR_NAME, 'cache');
}

function isSafeSessionId(sessionId) {
  return typeof sessionId === 'string' && sessionId.length > 0 && SAFE_SESSION_ID.test(sessionId);
}

function cacheFilePath(cacheDir, sessionId, key) {
  return path.join(cacheDir, `${sessionId}__${key}.json`);
}

// 읽기는 저위험이라(widget-config.js의 readEnabledWidgets와 동일 원칙) 격리 방어를
// 걸지 않는다 — 실수로 읽어도 아무것도 바뀌지 않는다.
function readCachedValue({ sessionId, key, cacheDir = resolveCacheDir() }) {
  if (!isSafeSessionId(sessionId)) return null;
  const filePath = cacheFilePath(cacheDir, sessionId, key);
  if (!fs.existsSync(filePath)) return null;
  let entry;
  try {
    entry = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null; // 손상된 캐시 파일 — 캐시 미스로 취급(에러로 위젯을 죽이지 않음)
  }
  if (
    typeof entry.value !== 'string' ||
    typeof entry.cached_at !== 'string' ||
    typeof entry.ttl_sec !== 'number'
  ) {
    return null;
  }
  const cachedAtMs = Date.parse(entry.cached_at);
  if (Number.isNaN(cachedAtMs)) return null;
  const ageSec = (Date.now() - cachedAtMs) / 1000;
  if (ageSec > entry.ttl_sec) return null; // 만료 — 호출자가 다시 직접 조회
  return entry.value;
}

// 명시적 cacheDir 인자는 방어막을 우회한다(단위테스트가 임시 경로를 넘기는 경우).
// 인자 없이 실제 기본 경로로 폴백할 때만 부분 격리 상태면 실제 파일 쓰기를 거부한다
// (widget-config.js와 동일한 2026-07-06 실측 확정 결함 부류 방어).
//
// 2026-08-03 실측 발견·수정: 이 함수는 "캐시 쓰기 실패는 기능을 막지 않는다"고
// 스스로 약속하지만, assertNotPartialIsolation()이 try 블록 "밖"에서 던지고 있어
// 실제로는 이 약속이 깨져 있었다 — 부분 격리 상태에서 호출하면 예외가 그대로
// git.js의 renderGit()까지 새어나가, 이미 정상적으로 조회해둔 실제 git 상태값까지
// 함께 버려지고 위젯 전체가 사라지는 걸 실제 빌드된 exe로 라이브 테스트하다가
// 직접 발견했다. 이 함수의 계약(호출자는 성공/실패를 신경 쓸 필요가 없어야 함)을
// 정확히 지키도록 try 블록을 전체로 넓혔다 — 부분 격리 거부를 포함해 그 어떤 이유로도
// 이 함수는 예외를 던지지 않는다.
function writeCachedValue({ sessionId, key, value, ttlSec, cacheDir }) {
  if (!isSafeSessionId(sessionId)) return;
  try {
    let resolvedCacheDir = cacheDir;
    if (resolvedCacheDir === undefined) {
      assertNotPartialIsolation('CLAUDETOWER_CACHE_DIR', '캐시 파일');
      resolvedCacheDir = resolveCacheDir();
    }
    const filePath = cacheFilePath(resolvedCacheDir, sessionId, key);
    const entry = {
      session_id: sessionId,
      key,
      value,
      cached_at: new Date().toISOString(),
      ttl_sec: ttlSec,
    };
    fs.mkdirSync(resolvedCacheDir, { recursive: true });
    // 소유자 전용 권한 시도 — POSIX에서는 실제로 제한되지만, Windows에서는
    // rotation-log.js에서 이미 실측 확인한 대로 mode 옵션이 실제 권한을 제한하지
    // 못한다. 이 캐시 파일은 감사 로그보다 민감도가 훨씬 낮아(같은 머신의 다른
    // 사용자가 git 브랜치명을 보는 정도) Windows 한계를 별도로 재확인·보고하지
    // 않는다(과잉 설계 방지) — 시도 자체는 남겨 POSIX 환경에서는 실제로 보호되게 한다.
    fs.writeFileSync(filePath, JSON.stringify(entry), { encoding: 'utf8', mode: 0o600 });
  } catch {
    // 캐시 쓰기 실패는 기능을 막지 않는다 — 다음 호출이 다시 직접 조회할 뿐이다
    // (캐시는 순수 최적화이지, 정확성이 캐시에 의존하지 않는다). 부분 격리 거부까지
    // 포함해 이 함수는 어떤 이유로도 절대 예외를 던지지 않는다(2026-08-03 확정).
  }
}

module.exports = { resolveCacheDir, isSafeSessionId, readCachedValue, writeCachedValue };
