'use strict';

// claudetower accounts enable 실행 시 출력할 동의 고지 상수.
// 문구 자체는 .PRD/08_ACCOUNTS_ENABLE_CONSENT_DRAFT.md 2026-07-27 하이브리드 개정판
// "초안(터미널에 그대로 출력될 문구)" 섹션 원문 그대로 — 사람이 검토·확정한 문구를
// 상수 문자열로 옮긴 것일 뿐, 새로 작성하지 않았다.
//
// 아직 어떤 CLI 명령도 이 상수를 호출하지 않는다(bin/claudetower.js 미연결). "해제
// 스위치"(CLI 라우팅 연결)는 credential-store 실동작 준비 이후로 보류 — CHECKPOINT
// "차단벽 앞까지"만 지금 준비 원칙 참고.

const CONSENT_TEXT_VERSION = 'v2-hybrid';

const CONSENT_TEXT = `⚠️  계정 자동 전환 기능을 켜기 전에 꼭 읽어주세요

지금까지 쓰신 상태표시줄(화면 아래 표시 기능)은 이 기능과 완전히 분리되어 있고,
계속 그대로 안전하게 작동합니다. 아래 내용은 "여러 계정을 자동으로 바꿔가며 쓰는
기능"에만 해당합니다.

1. 이 기능은 여러분의 Claude 계정 여러 개를 등록해두고, 사용량이 다 차면 자동으로
   다음 계정으로 바꿔줍니다. 로그인 계정(구독)과 API 키 계정을 섞어서 등록할 수
   있습니다. --import 옵션으로 이미 이 컴퓨터에 로그인된 Claude Code 계정을
   재로그인 없이 그대로 가져올 수도 있습니다.

2. 로그인 계정(구독, Free/Pro/Max)을 등록하는 경우: Anthropic(Claude를 만든 회사)의
   이용약관에는 구독 계정을 자동으로 순환시키는 행위가 명시적으로 허용되어 있지
   않습니다. --import로 재로그인을 생략하고 가져온 계정도 동일하게 해당됩니다.
   사용 중 계정이 일시 정지되거나 제한될 수 있으며, 이런 일이 생기더라도
   ClaudeTower(이 프로그램)가 책임지지 않습니다.

2-1. API 키 계정을 등록하는 경우: Anthropic 이용약관은 API 키를 통한 접근을
   자동화 금지 조항의 명시적 예외로 인정합니다. 다만 여러 개의 API 키를 동시에
   발급받아 로테이션하는 행위 자체가 별도의 남용 방지 조항에 걸리는지는
   확인되지 않았습니다 — 안전하다고 단정하지 않습니다.

3. 계정 정보(로그인 토큰)는 이 컴퓨터의 운영체제 금고
   (Windows: Credential Manager, macOS: Keychain, Linux: Secret Service)에만
   저장됩니다. 어디로도 전송되지 않습니다.

4. 언제든지 claudetower accounts disable로 다시 끌 수 있고, 꺼도 등록해둔 계정
   정보는 남아있습니다(완전히 지우려면 claudetower account-purge).

계속 진행하시겠습니까? 위 내용을 읽고 이해했다면 y를 입력해주세요. [y/N]:`;

module.exports = { CONSENT_TEXT, CONSENT_TEXT_VERSION };
