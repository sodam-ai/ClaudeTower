'use strict';

const { truncateForDisplay } = require('../config/text-safety');

// Claude Code stdin의 model.display_name을 그대로 보여준다(공식 문서 확인,
// .PRD/.archive/PulseLine원본/RESEARCH_SOURCES.md 223~226행 - 예: {"model":{"id":"claude-opus-4-8",
// "display_name":"Opus"}}). PulseLine 원본 설계에 있던 model 위젯이 ClaudeTower 통합
// 과정에서 누락돼 있던 것을 복원(실사용 피드백으로 발견).
function renderModel(session) {
  const displayName = session?.model?.display_name;
  if (typeof displayName !== 'string') {
    return null;
  }
  const trimmed = displayName.trim();
  if (trimmed.length === 0) {
    return null;
  }
  // "모델" 접두어 없이 모델 이름만 그대로 표시(실사용 피드백 — 예: "모델 Sonnet 5" → "Sonnet 5").
  return truncateForDisplay(trimmed);
}

module.exports = { renderModel };
