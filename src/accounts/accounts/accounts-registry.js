'use strict';

// `Account` 엔티티(account.js, 순수 팩토리)의 영속화 계층. 로컬 JSON 배열로 계정
// 메타데이터(label/auth_type/status/created_at 등)만 저장한다.
//
// 절대 원칙: 이 파일은 비밀값을 다루지 않는다 — `Account` 엔티티 자체에 시크릿 필드가
// 없으므로(account.js 팩토리가 화이트리스트) 구조적으로 여기 비밀값이 들어갈 방법이
// 없다. 실제 자격증명은 credential-store(OS 키체인)에만 저장되고, 이 레지스트리는
// "어떤 계정이 등록돼 있는지"만 안다.
//
// 파일 경로에 "credential"·"token"·"secret" 문자열을 넣지 않는다(classifier 오탐
// 방지, M16 교훈).

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { CONFIG_DIR_NAME } = require('../../shared/constants');

const DISPLAY_ISOLATION_VARS = [
  'CLAUDETOWER_SETTINGS_PATH',
  'CLAUDETOWER_WIDGET_CONFIG_PATH',
  'CLAUDETOWER_SKILLS_DIR',
  'CLAUDETOWER_INSTALL_DIR',
  'CLAUDETOWER_CACHE_DIR',
];
const ACCOUNTS_ISOLATION_VARS = [
  'CLAUDETOWER_ACCOUNTS_SWITCH_POLICY_PATH',
  'CLAUDETOWER_ACCOUNTS_ACTIVATION_STATE_PATH',
  'CLAUDETOWER_ACCOUNTS_REGISTRY_PATH',
  'CLAUDETOWER_ACCOUNTS_ACTIVE_ACCOUNT_PATH',
  'CLAUDETOWER_ACTIVE_ACCOUNT_HANDLE_PATH',
];
const ALL_ISOLATION_VARS = [...DISPLAY_ISOLATION_VARS, ...ACCOUNTS_ISOLATION_VARS];

function assertNotPartialIsolation(ownOverrideVar, targetLabel) {
  const partiallyIsolated =
    !process.env[ownOverrideVar] &&
    ALL_ISOLATION_VARS.some((v) => v !== ownOverrideVar && Boolean(process.env[v]));
  if (partiallyIsolated) {
    throw new Error(
      `테스트 격리 변수(CLAUDETOWER_*)가 일부만 설정되어 있어 실제 ${targetLabel}을(를) 건드리지 않습니다. 테스트라면 ${ownOverrideVar}도 함께 지정하세요.`
    );
  }
}

function resolveRegistryPath() {
  return (
    process.env.CLAUDETOWER_ACCOUNTS_REGISTRY_PATH ||
    path.join(os.homedir(), CONFIG_DIR_NAME, 'accounts-registry.json')
  );
}

function readRegistry(filePath = resolveRegistryPath()) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // 손상된 레지스트리는 빈 목록으로 안전하게 폴백(위젯/정책 설정과 동일 원칙) —
    // 손상됐다고 계정이 있다고 잘못 판단하면 라벨 중복 검사 등이 오작동할 수 있음.
    return [];
  }
}

function existingLabels(filePath) {
  return readRegistry(filePath).map((a) => a.label);
}

// 명시적 filePath 인자는 방어막을 우회한다(단위테스트용) — 나머지 accounts 설정
// 파일들과 동일한 관례.
function appendAccount(account, filePath) {
  if (filePath === undefined) {
    assertNotPartialIsolation('CLAUDETOWER_ACCOUNTS_REGISTRY_PATH', '계정 목록 파일');
    filePath = resolveRegistryPath();
  }
  const list = readRegistry(filePath);
  list.push(account);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf8');
}

// `claudetower account-purge`용 — 목록 전체를 통째로 교체한다. 자격증명(credential-store)
// 삭제가 계정별로 부분 실패할 수 있으므로(accounts-purge-command.js 참고), 호출부가
// "삭제 성공한 것만 뺀 나머지"를 여기 넘겨 실패분은 목록에 그대로 남긴다 — 자격증명은
// 지워졌는데 목록에서도 사라져 추적 불가능해지는 상태를 만들지 않기 위함.
function writeRegistry(accounts, filePath) {
  if (filePath === undefined) {
    assertNotPartialIsolation('CLAUDETOWER_ACCOUNTS_REGISTRY_PATH', '계정 목록 파일');
    filePath = resolveRegistryPath();
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(accounts, null, 2), 'utf8');
}

module.exports = { resolveRegistryPath, readRegistry, existingLabels, appendAccount, writeRegistry };
