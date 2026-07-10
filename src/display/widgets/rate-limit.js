'use strict';

const { pickColor, colorize, COLOR } = require('../config/thresholds');
const { renderGauge } = require('../config/gauge');

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Claude Code가 rate_limits.five_hour.resets_at(재설정 Unix epoch 초)을 함께 보내준다
// (공식 문서 확인, RESEARCH_SOURCES.md 196/272행). "H:MM" 타이머 형식으로 표시 —
// "재설정"이라는 단어 없이도 누구나 카운트다운으로 직관적으로 읽을 수 있어서 채택
// (사용자 선택, 8~9자짜리 "N시간 N분 후" 문구보다 훨씬 짧음).
// 2026-07-11 실측 발견: 5시간 윈도우인데 resets_at이 비현실적으로 먼 미래(예: 초 대신
// 밀리초 단위로 잘못 온 경우 등 데이터 이상)면 "40%·2282304:43"처럼 "H:MM" 형식이 깨져
// 보였다. 이미 지난 시각(하한)은 방어하면서 상한을 안 막은 비대칭이 원인 — stdin을
// 신뢰하지 않는 입력으로 취급한다는 원칙(04_PROJECT_SPEC.md)을 상한에도 동일하게 적용.
// 5시간 윈도우가 24시간 이상 남았다고 나오면 데이터를 신뢰하지 않고 숨긴다(여유 있게 24h).
const FIVE_HOUR_SANITY_MAX_MS = 24 * 60 * 60 * 1000;

function formatFiveHourReset(resetsAt, now = Date.now()) {
  if (!Number.isFinite(resetsAt)) return null;
  const msRemaining = resetsAt * 1000 - now;
  if (msRemaining <= 0) return null; // 이미 지난 시각이면(데이터 오차 등) 표시하지 않음(방어적)
  if (msRemaining > FIVE_HOUR_SANITY_MAX_MS) return null; // 비현실적으로 먼 미래도 동일하게 방어
  const totalMinutes = Math.floor(msRemaining / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${pad2(minutes)}`;
}

// 7일 윈도우는 "얼마 남았는지"보다 "언제(무슨 요일 몇 시)"가 더 직관적이라
// 상대시간 대신 절대 요일+시각으로 표시(사용자 예시 "일 오전 6:00"와 동일한 취지).
// 7일 윈도우도 동일한 원칙(위 formatFiveHourReset 주석 참고) — 30일 이상 남았다고
// 나오면 데이터를 신뢰하지 않고 숨긴다(여유 있게 30일, 7일 대비 넉넉한 마진).
const SEVEN_DAY_SANITY_MAX_MS = 30 * 24 * 60 * 60 * 1000;

function formatSevenDayReset(resetsAt, now = Date.now()) {
  if (!Number.isFinite(resetsAt)) return null;
  const ms = resetsAt * 1000;
  if (ms <= now) return null;
  if (ms - now > SEVEN_DAY_SANITY_MAX_MS) return null;
  const date = new Date(ms);
  return `${DAY_LABELS[date.getDay()]}${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

// rate_limits 자체가 통째로 없을 수 있고(Pro/Max 구독자만, 첫 API 응답 전엔 없음),
// five_hour/seven_day도 각각 독립적으로 없을 수 있음(공식 문서 확인,
// .PRD/.archive/PulseLine원본/RESEARCH_SOURCES.md 311행). 하나가 없어도 있는 것만 표시.
function renderRateLimit(session, now = Date.now()) {
  const fiveHour = session?.rate_limits?.five_hour?.used_percentage;
  const sevenDay = session?.rate_limits?.seven_day?.used_percentage;

  // Number.isFinite로 NaN과 Infinity/-Infinity를 함께 걸러낸다(context.js/cost.js와
  // 동일한 결함이 여기도 있었음 — 경계값 테스트로 발견).
  // 아이콘만으로는 처음 쓰는 사람이 뭘 뜻하는지 알기 어렵다는 실사용 피드백 반영 —
  // "5시간"/"7일" 한글 이름표 + 게이지바를 같이 넣는다.
  // "게이지바가 평범하다"는 피드백으로, 안전 구간도 항상 초록색을 입힌다(context.js와 동일 패턴).
  // Claude Code의 used_percentage가 부동소수점이라 "14.000000000000002%"로 그대로
  // 찍히는 결함이 실사용 중 발견됨 - context.js와 동일하게 반올림 후 표시/게이지/색상에
  // 일관되게 사용한다.
  const parts = [];
  if (Number.isFinite(fiveHour)) {
    // stdin은 신뢰하지 않는 입력으로 취급 — 음수·100 초과 값이 "-10%"·"150%"로 그대로
    // 노출되지 않도록 0~100으로 고정한다(context.js와 동일한 결함, 경계값 테스트로 발견).
    const rounded = Math.round(Math.max(0, Math.min(100, fiveHour)));
    const color = pickColor('rate_limit_5h', rounded);
    // 재설정 시간은 사용률과 무관하게 항상 표시한다(실사용 피드백 — 안전 구간에서도
    // 언제 리셋되는지 미리 알고 싶다는 요청으로 조건부 표시를 폐지).
    const reset = formatFiveHourReset(session?.rate_limits?.five_hour?.resets_at, now);
    const text = `5시간 ${renderGauge(rounded)} ${rounded}%${reset ? `·${reset}` : ''}`;
    parts.push(colorize(text, color || COLOR.safe));
  }
  if (Number.isFinite(sevenDay)) {
    const rounded = Math.round(Math.max(0, Math.min(100, sevenDay)));
    const color = pickColor('rate_limit_7d', rounded);
    const reset = formatSevenDayReset(session?.rate_limits?.seven_day?.resets_at, now);
    const text = `7일 ${renderGauge(rounded)} ${rounded}%${reset ? `·${reset}` : ''}`;
    parts.push(colorize(text, color || COLOR.safe));
  }

  // "5시간"/"7일" 이름표 자체가 이미 뜻을 설명하므로 ⏱·"사용률" 접두어는 생략(공간 절약).
  if (parts.length === 0) return null;
  return parts.join('  ');
}

module.exports = { renderRateLimit, formatFiveHourReset, formatSevenDayReset };
