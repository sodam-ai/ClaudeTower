'use strict';

// 퍼센트 값을 막대 그래프로 그린다. 아이콘만으로는 뭘 뜻하는지 알기 어렵다는
// 실사용 피드백을 반영 — 초보자도 "얼마나 찼는지"를 숫자를 안 읽어도 한눈에 알 수 있게.
// 상태표시줄은 한 줄짜리라 공간이 빠듯하다 — 8칸 적용 후 실측 결과(75자)가
// 여전히 길다는 사용자 피드백으로 6칸으로 축소(각 칸 16.7%, 70%/90% 임계값 경계는
// 반올림으로 여전히 육안 구분 가능).
const BAR_WIDTH = 6;
const FILLED = '▰';
const EMPTY = '▱';

function renderGauge(value, width = BAR_WIDTH) {
  if (!Number.isFinite(value)) return EMPTY.repeat(width);
  // 0~100 범위로 고정(음수·100 초과 값이 칸 수 계산을 깨지 않도록 — 경계값 테스트로 검증).
  const clamped = Math.max(0, Math.min(100, value));
  const filledCount = Math.round((clamped / 100) * width);
  return FILLED.repeat(filledCount) + EMPTY.repeat(width - filledCount);
}

module.exports = { renderGauge, BAR_WIDTH };
