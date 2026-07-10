'use strict';

// ProxyConfig 엔티티. .PRD/.archive/QuotaSwitch원본/02_DATA_MODEL.md "ProxyConfig" 절.
// bindAddress를 127.0.0.1 고정만 허용하는 이유: .PRD/04_PROJECT_SPEC.md "절대 하지 마" —
// "프록시를 0.0.0.0에 바인딩하지 마"를 데이터 모델 생성 시점부터 구조적으로 차단한다
// (호출부가 실수로 다른 값을 넘겨도 여기서 막힘 — 방어를 나중 단계로 미루지 않는다).

const FIXED_BIND_ADDRESS = '127.0.0.1';

function createProxyConfig({
  port,
  bindAddress = FIXED_BIND_ADDRESS,
  thresholdPct,
  upstreamUrl,
  accessToken,
  reevalIntervalMs,
  portRetryMax,
  lastPortChangeAt = null,
}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new TypeError('port must be an integer between 1 and 65535');
  }
  if (bindAddress !== FIXED_BIND_ADDRESS) {
    throw new TypeError(`bindAddress must be exactly "${FIXED_BIND_ADDRESS}" (0.0.0.0 금지, DO NOT 규칙)`);
  }
  if (typeof thresholdPct !== 'number' || !Number.isFinite(thresholdPct) || thresholdPct < 0 || thresholdPct > 100) {
    throw new TypeError('thresholdPct must be a number between 0 and 100');
  }
  if (typeof upstreamUrl !== 'string' || !upstreamUrl.startsWith('https://')) {
    throw new TypeError('upstreamUrl must be an https:// URL string');
  }
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new TypeError('accessToken must be a non-empty string');
  }
  if (!Number.isInteger(reevalIntervalMs) || reevalIntervalMs < 0) {
    throw new TypeError('reevalIntervalMs must be a non-negative integer (0 = 비활성)');
  }
  if (!Number.isInteger(portRetryMax) || portRetryMax < 1) {
    throw new TypeError('portRetryMax must be a positive integer');
  }
  if (lastPortChangeAt !== null && typeof lastPortChangeAt !== 'string') {
    throw new TypeError('lastPortChangeAt must be a string or null');
  }

  return {
    port,
    bind_address: bindAddress,
    threshold_pct: thresholdPct,
    upstream_url: upstreamUrl,
    access_token: accessToken,
    reeval_interval_ms: reevalIntervalMs,
    port_retry_max: portRetryMax,
    last_port_change_at: lastPortChangeAt,
  };
}

module.exports = { createProxyConfig, FIXED_BIND_ADDRESS };
