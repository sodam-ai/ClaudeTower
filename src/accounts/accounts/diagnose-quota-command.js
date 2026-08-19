'use strict';

// `claudetower accounts diagnose-quota <라벨>` — 등록된 API 키 계정으로 **최소 크기 요청
// 1건**을 실제 Anthropic API에 보내, 응답 헤더가 파서(../quota/api-key-quota-reading.js)가
// 기대하는 필드명(anthropic-ratelimit-tokens/requests-*, 출처: .PRD/07_OAUTH_FLOW_SPEC.md
// §5-4, github.com/jung-wan-kim/teamclaude 실측)과 실제로 일치하는지 1회 확인하는 진단
// 명령이다. 그 문서 자신이 "ClaudeTower 자신의 실제 API 응답으로 아직 재현 검증되지
// 않았다"고 명시한 부분을 채운다(2026-08-20).
//
// 절대 원칙: 이 명령은 **실제 비용/쿼터가 발생하는 유일한 Account 명령**이다 — 그래서
// account-purge와 동일하게 [y/N] 확인 없이는 절대 요청을 보내지 않는다(DO NOT 규칙:
// "확인 절차 없이 되돌릴 수 없거나 비용이 드는 동작을 즉시 실행하지 마"와 같은 정신).
// 자동 전환 자체는 이 명령이 하지 않는다 — 헤더를 "보여주기"만 한다(switch-decision.js를
// 여기서 호출하지 않음).

const https = require('node:https');
const { readRegistry } = require('./accounts-registry');
const { getSecret } = require('../credential-store');
const { backendForPlatform } = require('./add-api-key-command');
const { parseApiKeyQuotaHeaders } = require('../quota/api-key-quota-reading');

const API_HOST = 'api.anthropic.com';
const API_PATH = '/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
// 진단 목적의 최소 요청용 기본 모델 — Anthropic이 모델을 새로 내거나 이 모델을 폐기하면
// 이 기본값도 stale해질 수 있다(추측 금지 원칙을 어기는 게 아니라, 시간에 따라 자연히
// 낡는 값이라는 걸 알고 있다는 뜻). 그래서 하드코딩에 의존하지 않고 `--model` 플래그로
// 항상 덮어쓸 수 있게 하고, 실패 시 에러 메시지에서 그 사실을 안내한다.
const DEFAULT_MODEL = 'claude-3-5-haiku-20241022';

const EXPECTED_FIELDS = [
  'anthropic-ratelimit-tokens-limit',
  'anthropic-ratelimit-tokens-remaining',
  'anthropic-ratelimit-tokens-reset',
  'anthropic-ratelimit-requests-limit',
  'anthropic-ratelimit-requests-remaining',
  'anthropic-ratelimit-requests-reset',
];

function credentialRefFor(account) {
  return { account_id: account.account_id, backend: backendForPlatform(), external_ref: account.account_id };
}

// 실제 네트워크 요청 — 의도적으로 순수 함수가 아니다(이 명령의 목적 자체가 "실측").
// 응답 헤더는 상태 코드와 무관하게 항상 수집한다 — model 값이 틀려 4xx가 나도 rate-limit
// 헤더 자체는 붙어 있을 가능성이 있어 헤더 실측이라는 목적엔 지장이 없다.
function sendMinimalProbeRequest(apiKey, model) {
  const body = JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] });
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: API_HOST,
        path: API_PATH,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        timeout: 10000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') });
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('요청 시간 초과(10초)')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function runDiagnoseQuotaCommand(
  rl,
  label,
  { registryPath, model = DEFAULT_MODEL, log = () => {}, send = sendMinimalProbeRequest } = {}
) {
  const accounts = readRegistry(registryPath);
  const account = accounts.find((a) => a.label === label);
  if (!account) {
    log(`계정을 찾을 수 없습니다: ${label} (claudetower accounts list로 등록된 라벨을 확인하세요)`);
    return { applied: false, reason: 'account_not_found' };
  }
  if (account.auth_type !== 'api_key') {
    log(`이 진단은 API 키 계정만 지원합니다 — ${label}은(는) ${account.auth_type} 계정입니다.`);
    return { applied: false, reason: 'unsupported_auth_type' };
  }

  const apiKey = getSecret(credentialRefFor(account));
  if (apiKey === null) {
    log(`${label} 계정의 API 키를 credential store에서 찾을 수 없습니다.`);
    return { applied: false, reason: 'secret_not_found' };
  }

  log(
    `⚠️  실제 Anthropic API로 최소 크기 요청 1건을 보냅니다(model=${model}, max_tokens=1) — ` +
      '미세하지만 실제 비용/사용량이 발생합니다. 목적은 응답 헤더의 실제 필드명이 파서가 ' +
      '기대하는 이름과 일치하는지 확인하는 것뿐이며, 계정을 전환하지 않습니다.'
  );
  rl.output.write('계속하시겠습니까? [y/N]: ');
  const lineIterator = rl[Symbol.asyncIterator]();
  const { value, done } = await lineIterator.next();
  const answer = done ? '' : value;
  if (answer.trim().toLowerCase() !== 'y' && answer.trim().toLowerCase() !== 'yes') {
    log('취소했습니다 — 요청을 보내지 않았습니다.');
    return { applied: false, reason: 'cancelled' };
  }

  let response;
  try {
    response = await send(apiKey, model);
  } catch (err) {
    log(`요청 자체가 실패했습니다: ${err.message} (--model 플래그로 다른 모델 ID를 시도해보세요)`);
    return { applied: false, reason: 'request_failed', error: err.message };
  }

  const parsed = parseApiKeyQuotaHeaders(response.headers);
  const foundFields = EXPECTED_FIELDS.filter((f) => response.headers[f] !== undefined);
  const missingFields = EXPECTED_FIELDS.filter((f) => response.headers[f] === undefined);

  log(`응답 상태 코드: ${response.statusCode}`);
  log(`기대한 헤더 중 실제로 있었던 것 (${foundFields.length}/${EXPECTED_FIELDS.length}): ${foundFields.join(', ') || '없음'}`);
  if (missingFields.length > 0) {
    log(`기대했지만 없었던 헤더: ${missingFields.join(', ')}`);
  }
  log(
    parsed
      ? `파서 결과: 정상적으로 사용률을 계산했습니다 — ${JSON.stringify(parsed)}`
      : '파서 결과: 파싱 실패(기대한 헤더가 하나도 없음) — api-key-quota-reading.js의 필드명을 재검토해야 할 수 있습니다.'
  );

  return { applied: true, statusCode: response.statusCode, foundFields, missingFields, parsed };
}

module.exports = { runDiagnoseQuotaCommand, EXPECTED_FIELDS, DEFAULT_MODEL, sendMinimalProbeRequest };
