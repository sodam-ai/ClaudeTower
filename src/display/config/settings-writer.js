'use strict';

// ~/.claude/settings.json은 사용자의 실제 Claude Code 전역 설정 파일이다 —
// hooks/권한/MCP 등 다른 설정과 함께 들어있으므로 statusLine 키만 병합하고
// 나머지는 절대 건드리지 않는다. 실패해도 원본이 훼손되지 않도록 원자적 쓰기 +
// 백업을 사용한다.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

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

function writeStatusLineConfig(statusLineConfig, filePath = resolveSettingsPath()) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const existing = readExistingSettings(filePath);

  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, `${filePath}.bak`);
  }

  const merged = { ...existing, statusLine: statusLineConfig };
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath); // 원자적 교체(중간에 죽어도 원본 또는 tmp만 남고 반쯤 쓰인 파일이 안 남음)

  return { filePath, backedUp: fs.existsSync(`${filePath}.bak`) };
}

module.exports = { resolveSettingsPath, readExistingSettings, writeStatusLineConfig };
