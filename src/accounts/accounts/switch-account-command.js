'use strict';

// `claudetower accounts switch <라벨>` — 수동으로 활성 계정을 전환한다.
//
// 왜 지금 만드는가(2026-08-20 PRD 재검독으로 발견): `applySwitch()`(active-account-state.js,
// M46부터 완성돼 락·원자적쓰기·소유자 전용 권한까지 하드닝됨)를 실제로 호출하는 CLI 경로가
// 지금까지 0개였다 — 유일한 호출부인 active-account-provider.js는 🛑 실거래 배선 게이트로
// 막혀 있어 CLI에서 도달 불가능하다. rotation-event.js의 REASONS 화이트리스트에 처음부터
// 'manual'이 등록돼 있었던 것도 이 명령이 원래 설계에 있었다는 증거다 — 지금껏 아무도
// 발생시키지 않았을 뿐, 새로 지어내는 기능이 아니다. `.PRD/03_PHASES.md` Phase 3의
// "Account: ... 수동 강제 전환" 항목.
//
// ToS 안전성: applySwitch()가 이미 auth_type !== 'api_key'인 계정을 거부한다(OAuth/구독
// 계정 자동전환 금지와 동일 원칙) — 이 명령은 그 검증을 다시 구현하지 않고 applySwitch에
// 그대로 위임한다(아래 사전 확인은 오직 더 친절한 메시지를 위한 것일 뿐, 최종 판단은 항상
// applySwitch/updateRegistry의 락 시점 최신 상태 기준). 자동 감지·자동 순환이 아니라
// 사용자가 매번 명령을 직접 실행하는 1회성 전환이라 07_OAUTH_FLOW_SPEC.md §3-3이 인용한
// "구독제 자동화 접근 금지" 조항과도 무관하다(API 키 접근은 그 조항의 명시적 예외).
//
// reevalIntervalMs를 의도적으로 0으로 고정: 그 스로틀은 "매 응답마다 자동 재평가가
// 반복 트리거되는 진동"을 막으려고 만들어졌다(active-account-state.js 상단 주석 참고) —
// 사용자가 이번에 명시적으로 요청한 수동 전환까지 그 스로틀로 보류시킬 이유가 없다.
//
// 확인 절차 없음: rename과 동일한 원칙(04_PROJECT_SPEC.md DO NOT가 확인을 요구하는 대상은
// remove·purge뿐 — switch는 되돌릴 수 있고(다시 switch하면 됨) 자격증명을 삭제하지도 않는다).

const { readRegistry } = require('./accounts-registry');
const { readActiveAccountId, applySwitch } = require('./active-account-state');

function runSwitchAccountCommand(
  label,
  { registryPath, statePath, rotationLogPath, activeAccountHandlePath, log = () => {} } = {}
) {
  if (typeof label !== 'string' || label.trim().length === 0) {
    log('사용법: claudetower accounts switch <라벨>');
    return { applied: false, reason: 'label_required' };
  }

  const accounts = readRegistry(registryPath);
  const target = accounts.find((a) => a.label === label);
  if (!target) {
    log(`계정을 찾을 수 없습니다: ${label} (claudetower accounts list로 등록된 라벨을 확인하세요)`);
    return { applied: false, reason: 'account_not_found' };
  }
  if (target.auth_type !== 'api_key') {
    log(
      `"${label}"은(는) 로그인(구독) 계정입니다 — 전환은 API 키 계정만 지원합니다(Anthropic 이용약관상 로그인 계정 자동화는 금지 대상입니다).`
    );
    return { applied: false, reason: 'not_api_key_account' };
  }
  if (target.status !== 'active') {
    log(`"${label}"은(는) 지금 활성 상태가 아니라 전환할 수 없습니다(status: ${target.status}).`);
    return { applied: false, reason: 'target_not_active' };
  }

  const fromAccountId = readActiveAccountId(statePath);
  if (fromAccountId === target.account_id) {
    log(`이미 "${label}" 계정을 사용 중입니다 — 아무 것도 바꾸지 않았습니다.`);
    return { applied: false, reason: 'already_active' };
  }

  const decision = { shouldSwitch: true, toAccountId: target.account_id, reason: 'manual' };
  const result = applySwitch(decision, {
    fromAccountId,
    registryPath,
    statePath,
    rotationLogPath,
    activeAccountHandlePath,
    projectPath: process.cwd(),
    reevalIntervalMs: 0,
  });

  if (!result.applied) {
    log(`전환하지 못했습니다: ${result.reason}`);
    return result;
  }

  log(`"${label}" 계정으로 전환했습니다.`);
  return result;
}

module.exports = { runSwitchAccountCommand };
