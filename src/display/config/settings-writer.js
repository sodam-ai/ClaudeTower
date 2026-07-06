'use strict';

// ~/.claude/settings.json은 사용자의 실제 Claude Code 전역 설정 파일이다 —
// hooks/권한/MCP 등 다른 설정과 함께 들어있으므로 statusLine 키만 병합하고
// 나머지는 절대 건드리지 않는다. 실패해도 원본이 훼손되지 않도록 원자적 쓰기 +
// 백업을 사용한다.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { assertNotPartialIsolation } = require('./test-isolation');

// 테스트가 실제 ~/.claude/settings.json을 건드리지 않도록 환경변수로 경로를 바꿀 수 있게 함.
function resolveSettingsPath() {
  return process.env.CLAUDETOWER_SETTINGS_PATH || path.join(os.homedir(), '.claude', 'settings.json');
}

function readExistingSettings(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  if (raw.trim().length === 0) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    // 손상된 기존 설정을 침묵 속에 덮어쓰지 않는다 — 호출자가 사용자에게 알리고 중단해야 함.
    throw new Error(`기존 settings.json이 손상되어 있습니다(${filePath}): ${err.message}`);
  }
}

// write/remove가 공유하는 원자적 쓰기(임시파일 -> rename, 실패 시 .tmp 정리).
function atomicWriteJson(filePath, data) {
  const tmpPath = `${filePath}.tmp`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath); // 원자적 교체(중간에 죽어도 원본 또는 tmp만 남고 반쯤 쓰인 파일이 안 남음)
  } catch (err) {
    // 권한 거부 등으로 rename이 실패해도 .tmp 잔여물을 남기지 않는다(QA 중 실제로
    // 읽기 전용 파일 대상 쓰기 실패 시 .tmp가 정리 안 되고 남는 결함을 발견해 수정).
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // .tmp 자체가 안 만들어졌거나 이미 없으면 무시
    }
    throw err;
  }
}

// 아래 세 쓰기/삭제 함수는 명시적 filePath 인자가 없을 때(실제 기본 경로 폴백)만
// 부분 격리 방어막을 거친다 — 위젯 설정과 동일한 원칙(test-isolation.js 참고).
// 읽기 전용인 readExistingStatusLineConfig는 막지 않는다.
function writeStatusLineConfig(statusLineConfig, filePath) {
  if (filePath === undefined) {
    assertNotPartialIsolation('CLAUDETOWER_SETTINGS_PATH', 'settings.json');
    filePath = resolveSettingsPath();
  }
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const existing = readExistingSettings(filePath);

  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, `${filePath}.bak`);
  }

  const merged = { ...existing, statusLine: statusLineConfig };
  atomicWriteJson(filePath, merged);

  return { filePath, backedUp: fs.existsSync(`${filePath}.bak`) };
}

// claudetower uninstall용 — statusLine 키만 제거하고 hooks/권한 등 나머지 설정은
// 손대지 않는다("제거하려면 사용자가 settings.json을 손으로 고쳐야 해서 다른 설정까지
// 실수로 지울 위험이 있다"는 실사용 피드백으로 추가).
// .PRD/06_FIELD_ISSUE_SPAWN_STORM_2026-07-04.md FR-2: setup을 다시 실행할 때
// 사용자가 이미 조정해둔 refreshInterval을 기본값 1로 되돌리지 않기 위해, 호출자
// (setup-wizard)가 재실행 전 기존 값을 먼저 확인할 수 있게 노출한다.
function readExistingStatusLineConfig(filePath = resolveSettingsPath()) {
  return readExistingSettings(filePath).statusLine;
}

// .PRD/06_FIELD_ISSUE_SPAWN_STORM_2026-07-04.md FR-1: `claudetower config
// statusline-refresh <초>`가 호출하는 함수 — statusLine의 command/type은 그대로
// 두고 refreshInterval 키만 바꾼다. 아직 설치(=statusLine 등록) 자체가 안 된
// 상태에서 이 명령을 쓰면 무엇을 바꿀지 알 수 없으므로 명확히 에러를 던진다.
function updateRefreshInterval(refreshInterval, filePath) {
  if (filePath === undefined) {
    assertNotPartialIsolation('CLAUDETOWER_SETTINGS_PATH', 'settings.json');
    filePath = resolveSettingsPath();
  }
  const existing = readExistingSettings(filePath);
  if (!existing.statusLine) {
    throw new Error('아직 claudetower가 설치되어 있지 않습니다. 먼저 claudetower setup을 실행하세요.');
  }
  fs.copyFileSync(filePath, `${filePath}.bak`);
  const merged = { ...existing, statusLine: { ...existing.statusLine, refreshInterval } };
  atomicWriteJson(filePath, merged);
  return { filePath, refreshInterval };
}

function removeStatusLineConfig(filePath) {
  if (filePath === undefined) {
    assertNotPartialIsolation('CLAUDETOWER_SETTINGS_PATH', 'settings.json');
    filePath = resolveSettingsPath();
  }
  if (!fs.existsSync(filePath)) {
    return { filePath, removed: false, backedUp: false };
  }

  const existing = readExistingSettings(filePath);
  if (!('statusLine' in existing)) {
    return { filePath, removed: false, backedUp: false };
  }

  fs.copyFileSync(filePath, `${filePath}.bak`);
  const { statusLine, ...rest } = existing;
  atomicWriteJson(filePath, rest);

  return { filePath, removed: true, backedUp: true };
}

module.exports = {
  resolveSettingsPath,
  readExistingSettings,
  writeStatusLineConfig,
  removeStatusLineConfig,
  readExistingStatusLineConfig,
  updateRefreshInterval,
};
