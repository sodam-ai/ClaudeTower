'use strict';

// 모듈 경계 강제(1/3중 방어: ESLint 정적 분석) — .PRD/04_PROJECT_SPEC.md
// "Display 모듈 코드는 src/accounts/ 하위 모듈을 require/import하지 않는다 — 정적 분석(lint 규칙)으로 강제"
//
// 시도 이력(카나리아 테스트로 실측 확인):
//  1) 코어 no-restricted-imports(group glob) — `require('../accounts/...')` 같은 상대경로
//     문자열을 못 잡는 결함 발견, 폐기.
//  2) eslint-plugin-import-x의 no-restricted-paths — ES import 구문 전용으로 설계돼
//     CommonJS require()는 애초에 분석 대상이 아님, 이 프로젝트는 CJS 고정이라 폐기.
//  3) (채택) require() 호출을 실제 파일 경로로 resolve해서 zone을 비교하는 커스텀 규칙.
//     외부 플러그인 없이 ESLint 코어 API만 사용 — 카나리아 재검증으로 실제 작동 확인.

const path = require('node:path');

const ZONES = [
  {
    target: path.join(__dirname, 'src', 'display'),
    from: path.join(__dirname, 'src', 'accounts'),
    message: 'Display 모듈은 Account 모듈을 참조할 수 없습니다 (.PRD/02_DATA_MODEL.md 모듈 경계 규칙).',
  },
  {
    target: path.join(__dirname, 'src', 'display'),
    from: path.join(__dirname, 'src', 'shared', 'active-account-handle', 'write.js'),
    message: 'Display 모듈은 active-account-handle의 쓰기 함수를 참조할 수 없습니다. read.js만 사용하세요.',
  },
  {
    target: path.join(__dirname, 'src', 'accounts'),
    from: path.join(__dirname, 'src', 'display'),
    message: 'Account 모듈은 Display 모듈을 참조할 필요가 없습니다 — 결합을 만들지 마세요.',
  },
];

function isUnder(childPath, parentPath) {
  return childPath === parentPath || childPath.startsWith(parentPath + path.sep);
}

const noCrossZoneRequireRule = {
  meta: {
    type: 'problem',
    docs: { description: '모듈 경계를 넘는 require() 호출 금지 (resolve된 실경로 기준)' },
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    return {
      CallExpression(node) {
        const isRequireCall =
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require' &&
          node.arguments.length === 1 &&
          node.arguments[0].type === 'Literal' &&
          typeof node.arguments[0].value === 'string';
        if (!isRequireCall) return;

        const specifier = node.arguments[0].value;
        if (!specifier.startsWith('.')) return; // 상대경로만 검사 (npm 패키지 require는 대상 아님)

        const resolvedPath = path.resolve(path.dirname(filename), specifier);

        for (const zone of ZONES) {
          if (isUnder(filename, zone.target) && isUnder(resolvedPath, zone.from)) {
            context.report({ node, message: zone.message });
          }
        }
      },
    };
  },
};

module.exports = [
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
      },
    },
    plugins: {
      local: { rules: { 'no-cross-zone-require': noCrossZoneRequireRule } },
    },
    rules: {
      'local/no-cross-zone-require': 'error',
    },
  },
];
