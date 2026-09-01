'use strict';

// 마켓플레이스 래퍼(M65)의 회귀 테스트. 이 프로젝트의 다른 모든 기능과 달리 M65 구현 당시
// 자동 테스트 없이 `node -e` 수동 확인만으로 커밋됐다 — 이 파일이 그 빈틈을 메운다. 이
// 프로젝트가 이미 반복적으로 겪은 회귀(예: SKILL.md `name:` 프론트매터 누락, M62)와 같은
// 부류의 문제를 여기서도 기계적으로 막는 것이 목적이다.
//
// 2026-09-01 M67: `.claude-plugin/`·`commands/`는 원래 `plugin/` 폴더 안에 한 겹 더
// 들어가 있었으나, 실제 라이브 테스트에서 `/plugin marketplace add`가 marketplace.json을
// 못 찾아 실패했다(Claude Code는 저장소 루트에서 바로 찾는다) — 저장소 루트로 옮긴 뒤
// 이 테스트의 경로 상수도 함께 갱신했다.
//
// 이 명령들은 Display 전용 명령만 감싼다(Account는 별도 opt-in 원칙 유지, M65 결정) — 그래서
// src/accounts/를 참조하지 않고, verify-display-standalone CI job(src/accounts/ 삭제 후
// npm run verify)에서도 그대로 통과해야 한다.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const CLAUDE_PLUGIN_DIR = path.join(ROOT, '.claude-plugin');
const COMMANDS_DIR = path.join(ROOT, 'commands');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('package.json의 버전이 존재한다(아래 plugin.json 대조용 전제 확인)', () => {
  const pkg = readJson(path.join(ROOT, 'package.json'));
  assert.equal(typeof pkg.version, 'string');
  assert.ok(pkg.version.length > 0);
});

test('plugin.json이 유효한 JSON이고 필수 필드를 전부 갖췄다', () => {
  const manifest = readJson(path.join(CLAUDE_PLUGIN_DIR, 'plugin.json'));
  assert.equal(typeof manifest.name, 'string');
  assert.equal(manifest.name, 'claudetower');
  assert.equal(typeof manifest.version, 'string');
  assert.equal(typeof manifest.description, 'string');
  assert.equal(typeof manifest.author?.name, 'string');
  assert.equal(manifest.license, 'Apache-2.0');
  assert.deepEqual(manifest.commands, ['./commands/']);
});

test('plugin.json의 version이 package.json과 어긋나면 실패한다 — 수동 동기화를 잊는 걸 잡는 회귀 테스트(M65가 스스로 남긴 위험)', () => {
  const pkg = readJson(path.join(ROOT, 'package.json'));
  const manifest = readJson(path.join(CLAUDE_PLUGIN_DIR, 'plugin.json'));
  assert.equal(
    manifest.version,
    pkg.version,
    `plugin.json version(${manifest.version})이 package.json version(${pkg.version})과 다릅니다 — CLI 버전을 올릴 때 plugin.json도 함께 갱신하세요.`
  );
});

test('marketplace.json이 유효한 JSON이고 단일 플러그인을 자기참조한다', () => {
  const marketplace = readJson(path.join(CLAUDE_PLUGIN_DIR, 'marketplace.json'));
  assert.equal(typeof marketplace.$schema, 'string');
  assert.equal(typeof marketplace.name, 'string');
  assert.equal(typeof marketplace.owner?.name, 'string');
  assert.equal(marketplace.plugins.length, 1);
  assert.equal(marketplace.plugins[0].name, 'claudetower');
  assert.equal(marketplace.plugins[0].source, './');
});

test('marketplace.json 안의 plugin 버전이 plugin.json과 일치한다(둘 다 손으로 관리하는 값이라 어긋나기 쉬움)', () => {
  const manifest = readJson(path.join(CLAUDE_PLUGIN_DIR, 'plugin.json'));
  const marketplace = readJson(path.join(CLAUDE_PLUGIN_DIR, 'marketplace.json'));
  assert.equal(marketplace.plugins[0].version, manifest.version);
});

test('marketplace.json의 source("./")가 가리키는 위치에 실제로 plugin.json이 있다', () => {
  const marketplace = readJson(path.join(CLAUDE_PLUGIN_DIR, 'marketplace.json'));
  const sourceDir = path.join(CLAUDE_PLUGIN_DIR, marketplace.plugins[0].source);
  assert.ok(fs.existsSync(path.join(sourceDir, 'plugin.json')), 'source가 가리키는 위치에 plugin.json이 없습니다');
});

const EXPECTED_COMMANDS = ['config.md', 'status.md', 'widgets.md'];

test('commands/ 폴더에 의도한 3개 파일만 있다(추가·삭제 시 이 목록도 함께 갱신할 것)', () => {
  const actual = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.md')).sort();
  assert.deepEqual(actual, EXPECTED_COMMANDS);
});

for (const filename of EXPECTED_COMMANDS) {
  const commandName = filename.replace('.md', '');

  test(`commands/${filename} — frontmatter 2번째 줄이 정확히 "name: claudetower:${commandName}"이다(SKILL.md name: 누락 회귀, M62와 동일한 부류 방지)`, () => {
    const content = readText(path.join(COMMANDS_DIR, filename));
    const lines = content.split('\n');
    assert.equal(lines[0], '---', `${filename}의 첫 줄이 frontmatter 시작(---)이 아닙니다`);
    assert.equal(
      lines[1],
      `name: claudetower:${commandName}`,
      `${filename}의 2번째 줄이 name: claudetower:${commandName}이 아닙니다`
    );
  });

  test(`commands/${filename} — description·allowed-tools 필드가 존재한다`, () => {
    const content = readText(path.join(COMMANDS_DIR, filename));
    const frontmatterEnd = content.indexOf('\n---', 4);
    const frontmatter = content.slice(0, frontmatterEnd);
    assert.match(frontmatter, /^description: .+$/m, `${filename}에 description 필드가 없습니다`);
    assert.match(frontmatter, /^allowed-tools: .+$/m, `${filename}에 allowed-tools 필드가 없습니다`);
  });

  // 2026-09-01 M73: PATH 미등록/미반영(WM_SETTINGCHANGE 전파 지연 등) 상황에서도
  // 명령이 막히지 않도록, 자기 자신의 서브명령 하나 + 고정 설치 위치(항상 유효,
  // claudetower setup이 스스로 정착시키는 위치) 직접 호출 2가지(OS별 확장자)까지만
  // 딱 3개로 좁힌다 — 여전히 "이 CLI의 이 서브명령"으로만 한정된 최소 권한.
  test(`commands/${filename} — allowed-tools가 자기 자신의 CLI 서브명령 + 고정 설치 경로(PATH 우회용) 3개로만 좁혀져 있다(최소 권한 원칙, 다른 서브명령이 몰래 섞이면 실패)`, () => {
    const content = readText(path.join(COMMANDS_DIR, filename));
    const allowedToolsLine = content.split('\n').find((line) => line.startsWith('allowed-tools:'));
    assert.ok(allowedToolsLine, `${filename}에서 allowed-tools 줄을 못 찾았습니다`);
    const expected = [
      `Bash(claudetower ${commandName}:*)`,
      `Bash($HOME/.claudetower/bin/claudetower ${commandName}:*)`,
      `Bash($HOME/.claudetower/bin/claudetower.exe ${commandName}:*)`,
    ].join(', ');
    assert.equal(
      allowedToolsLine.trim(),
      `allowed-tools: ${expected}`,
      `${filename}의 allowed-tools가 claudetower ${commandName} 서브명령 + 고정 경로 3개로만 좁혀져 있지 않습니다`
    );
  });
}

test('명령 파일 어디에도 이 컴퓨터의 실제 사용자 홈 경로가 하드코딩돼 있지 않다(마켓플레이스로 공개 배포되는 파일이라 개인정보 유출 방지가 특히 중요)', () => {
  const leakPattern = /C:\\Users\\[^"'\s]+|\/Users\/[^"'\s/]+|\/home\/[^"'\s/]+/;
  for (const filename of [...EXPECTED_COMMANDS, '../.claude-plugin/plugin.json', '../.claude-plugin/marketplace.json', '../PLUGIN.md']) {
    const filePath = path.join(COMMANDS_DIR, filename);
    const content = readText(filePath);
    assert.doesNotMatch(content, leakPattern, `${filename}에 절대경로(개인정보 유출 가능)가 있습니다`);
  }
});

test('PLUGIN.md가 존재하고 실제 마켓플레이스 설치 명령을 담고 있다', () => {
  const content = readText(path.join(ROOT, 'PLUGIN.md'));
  assert.match(content, /\/plugin marketplace add sodam-ai\/ClaudeTower/);
  assert.match(content, /\/plugin install claudetower@claudetower-marketplace/);
});
