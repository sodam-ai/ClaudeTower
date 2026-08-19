'use strict';

// `claudetower accounts config` — 계정 전환 임계값·전략·포트·재평가주기를 credential-
// store 없이도 미리 조정할 수 있게 한다(.PRD/03_PHASES.md 89행). 인자 없이 실행하면
// 현재 값을 전부 보여주고, `<key> <value>` 형태로 실행하면 그 값 하나만 바꾼다
// (src/display/config-command.js와 동일한 UX 관례). `enable` 등 계정 활성화·프록시
// 기동·credential-store 접근은 이 명령의 범위 밖이다(M32/status와 동일 원칙).

const { DEFAULTS, STRATEGIES, readSwitchPolicy, writeSwitchPolicyField } = require('./switch-policy-config');

function formatPolicy(policy) {
  return [
    '=== ClaudeTower 계정 전환 정책 (credential 무관, 로컬 저장) ===',
    '',
    `threshold_pct: ${policy.threshold_pct}  (전환 임계값 %, 50~100)`,
    `port: ${policy.port}  (로컬 프록시 리슨 포트, 1024~65535)`,
    `strategy: ${policy.strategy}  (${STRATEGIES.join(' 또는 ')})`,
    `reeval_interval_ms: ${policy.reeval_interval_ms}  (0 = 비활성)`,
    `port_retry_max: ${policy.port_retry_max}`,
    '',
    '이 값들은 실제 프록시가 아직 기동되지 않은 상태에서 미리 저장만 됩니다',
    '(credential-store가 완료돼야 실제로 사용됩니다). 변경: claudetower accounts config <key> <value>',
  ].join('\n');
}

function runAccountsConfigCommand(args, { switchPolicyPath, log = () => {} } = {}) {
  const [key, value] = args;

  if (key === undefined) {
    log(formatPolicy(readSwitchPolicy(switchPolicyPath)));
    return { applied: true, policy: readSwitchPolicy(switchPolicyPath) };
  }

  if (!(key in DEFAULTS)) {
    log(`알 수 없는 설정 키: ${key}`);
    log(`사용 가능한 키: ${Object.keys(DEFAULTS).join(', ')}`);
    log('사용법: claudetower accounts config <key> <value>');
    return { applied: false };
  }

  if (value === undefined) {
    log(`사용법: claudetower accounts config ${key} <값>`);
    return { applied: false };
  }

  try {
    const applied = writeSwitchPolicyField(key, value, switchPolicyPath);
    log(`${key}을(를) ${applied}(으)로 설정했습니다.`);
    return { applied: true, [key]: applied };
  } catch (err) {
    log(err.message);
    return { applied: false };
  }
}

module.exports = { runAccountsConfigCommand };
