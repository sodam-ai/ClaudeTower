'use strict';

// request-forwarder.js(M44)가 필요로 하는 두 콜백(getApiKey/onUpstreamHeaders)을 실제
// 상태(registry+credential-store+active-account-state+quota 판단 로직)와 이어 붙인다.
// 이 파일이 proxy/ 안에서 credential-store를 직접 require하는 유일한 파일이다 —
// active-account-state.js는 의도적으로 credential-store를 모른다(그 파일 주석 참고).
//
// createActiveAccountProvider가 반환하는 두 함수는 그대로 createRequestForwarder에
// 주입할 수 있는 형태다. 다만 이 조합 자체를 실제 claudetower run 진입점에 연결하는
// 것은 여전히 하지 않는다(2026-08-19 방향 결정 유지) — 이 파일도 무엇이 startProxyServer를
// 실제로 부르는지 모른다.
//
// 알려진 트레이드오프(숨기지 않고 명시): onUpstreamHeaders는 매 응답마다 registry·
// 활성상태·정책 파일을 동기(sync) 읽기한다 — 전환이 일어나지 않는 흔한 경우에도 그렇다.
// 실제 배선 전까지는 트래픽량을 알 수 없어 최적화(캐싱 등)를 지금 하지 않는다 — 조기
// 최적화보다, 실제로 켜본 뒤 필요하면 그때 다룬다(범위 확대 자제).

const { readRegistry } = require('../accounts/accounts-registry');
const { getSecret } = require('../credential-store');
const { backendForPlatform } = require('../accounts/add-api-key-command');
const { readActiveAccountId, applySwitch } = require('../accounts/active-account-state');
const { readSwitchPolicy } = require('../switch-policy-config');
const { parseApiKeyQuotaHeaders } = require('../quota/api-key-quota-reading');
const { evaluateSwitchDecision } = require('../quota/switch-decision');

function credentialRefFor(account) {
  return { account_id: account.account_id, backend: backendForPlatform(), external_ref: account.account_id };
}

// 활성 계정이 아직 한 번도 선택된 적 없으면(최초 실행 등), registry의 첫 번째 사용
// 가능한(api_key + active) 계정을 자동으로 채택한다 — 그래야 claudetower를 막 켰을 때
// "활성 계정 없음"으로 곧바로 막히지 않는다. 저장된 포인터가 가리키는 계정이 더 이상
// 못 쓰는 상태(삭제/비활성화됨)면 같은 폴백을 쓴다.
// 참고: 이 함수의 자동 채택 결과는 상태 파일에 기록되지 않는다(순수 조회) — 실제
// 전환(applySwitch)이 한 번도 안 일어났으면 활성 계정 상태 파일·active-account-handle은
// 계속 비어 있는다. 지금은 이걸 읽는 실사용 소비자(Display 위젯 등)가 아직 없어 문제가
// 안 되지만, 나중에 "최초 실행 때부터 어느 계정을 쓰는지 보여줘야" 한다면 이 함수 호출
// 시점에 최초 1회 기록하는 로직을 추가해야 한다(2026-08-20, 이번 범위 밖으로 명시).
function resolveCurrentAccount(accounts, statePath) {
  const currentId = readActiveAccountId(statePath);
  if (currentId) {
    const found = accounts.find((a) => a.account_id === currentId && a.status === 'active' && a.auth_type === 'api_key');
    if (found) return found;
  }
  return accounts.find((a) => a.status === 'active' && a.auth_type === 'api_key') || null;
}

function createActiveAccountProvider({
  registryPath,
  statePath,
  rotationLogPath,
  activeAccountHandlePath,
  policyPath,
  projectPath = null,
} = {}) {
  async function getApiKey() {
    const accounts = readRegistry(registryPath);
    const account = resolveCurrentAccount(accounts, statePath);
    if (!account) {
      throw new Error('등록된 사용 가능한 API 키 계정이 없습니다(claudetower accounts add --api-key로 먼저 등록하세요)');
    }
    const apiKey = getSecret(credentialRefFor(account));
    if (apiKey === null) {
      throw new Error(`${account.label} 계정의 API 키를 credential store에서 찾을 수 없습니다`);
    }
    return apiKey;
  }

  function onUpstreamHeaders(headers) {
    const accounts = readRegistry(registryPath);
    const currentAccount = resolveCurrentAccount(accounts, statePath);
    if (!currentAccount) return; // getApiKey가 이미 막았을 상황 — 방어적으로 재확인만.

    const reading = parseApiKeyQuotaHeaders(headers);
    const policy = readSwitchPolicy(policyPath);
    const decision = evaluateSwitchDecision({
      currentAccountId: currentAccount.account_id,
      currentQuotaReading: reading,
      allAccounts: accounts,
      policy,
    });

    applySwitch(decision, {
      fromAccountId: currentAccount.account_id,
      registryPath,
      statePath,
      rotationLogPath,
      activeAccountHandlePath,
      projectPath,
      reevalIntervalMs: policy.reeval_interval_ms,
    });
  }

  return { getApiKey, onUpstreamHeaders };
}

module.exports = { createActiveAccountProvider, resolveCurrentAccount };
