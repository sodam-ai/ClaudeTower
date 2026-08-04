'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { renderGit, queryGitStatus, formatGitValue } = require('../../src/display/widgets/git');

// 전부 실제 임시 git 저장소를 만들어 진짜 git 명령으로 검증한다(mock 아님) —
// 지난 라운드(PKCE RFC 벡터, 프록시 서버 실제 소켓)와 동일한 원칙.
function initTempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-git-widget-test-'));
  execFileSync('git', ['init', '--quiet'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  return dir;
}

function commitFile(dir, name, content) {
  fs.writeFileSync(path.join(dir, name), content, 'utf8');
  execFileSync('git', ['add', name], { cwd: dir });
  execFileSync('git', ['commit', '--quiet', '-m', `add ${name}`], { cwd: dir });
}

test('queryGitStatus: 깨끗한 저장소는 "브랜치|0|0"을 반환한다', () => {
  const dir = initTempRepo();
  execFileSync('git', ['checkout', '--quiet', '-b', 'feature-x'], { cwd: dir });
  commitFile(dir, 'a.txt', 'hello');
  assert.equal(queryGitStatus(dir), 'feature-x|0|0');
});

test('queryGitStatus: git 저장소가 아닌 디렉터리는 null을 반환한다(위젯 숨김, 크래시 아님)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-not-a-repo-'));
  assert.equal(queryGitStatus(dir), null);
});

test('queryGitStatus: staged 파일이 있으면 staged 개수에 반영된다', () => {
  const dir = initTempRepo();
  execFileSync('git', ['checkout', '--quiet', '-b', 'main-test'], { cwd: dir });
  commitFile(dir, 'a.txt', 'hello');
  fs.writeFileSync(path.join(dir, 'b.txt'), 'new file', 'utf8');
  execFileSync('git', ['add', 'b.txt'], { cwd: dir });
  assert.equal(queryGitStatus(dir), 'main-test|1|0');
});

test('queryGitStatus: 커밋된 파일을 수정(미스테이지)하면 modified 개수에 반영된다', () => {
  const dir = initTempRepo();
  execFileSync('git', ['checkout', '--quiet', '-b', 'main-test'], { cwd: dir });
  commitFile(dir, 'a.txt', 'hello');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'changed', 'utf8');
  assert.equal(queryGitStatus(dir), 'main-test|0|1');
});

test('queryGitStatus: staged+modified가 섞이면 둘 다 정확히 센다', () => {
  const dir = initTempRepo();
  execFileSync('git', ['checkout', '--quiet', '-b', 'main-test'], { cwd: dir });
  commitFile(dir, 'a.txt', 'hello');
  commitFile(dir, 'c.txt', 'world');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'changed', 'utf8'); // modified, unstaged
  fs.writeFileSync(path.join(dir, 'b.txt'), 'new', 'utf8');
  execFileSync('git', ['add', 'b.txt'], { cwd: dir }); // staged new file
  execFileSync('git', ['rm', '--cached', '--quiet', 'c.txt'], { cwd: dir }); // staged removal
  assert.equal(queryGitStatus(dir), 'main-test|2|1');
});

test('queryGitStatus: untracked 파일은 staged/modified 어느 쪽에도 세지 않는다(명시적 설계 판단, 회귀 방지 고정 테스트)', () => {
  const dir = initTempRepo();
  execFileSync('git', ['checkout', '--quiet', '-b', 'main-test'], { cwd: dir });
  commitFile(dir, 'a.txt', 'hello');
  fs.writeFileSync(path.join(dir, 'untracked.txt'), 'nobody adds me', 'utf8');
  assert.equal(queryGitStatus(dir), 'main-test|0|0');
});

test('queryGitStatus: 슬래시가 들어간 브랜치명(feature/foo)도 그대로 반환한다', () => {
  const dir = initTempRepo();
  execFileSync('git', ['checkout', '--quiet', '-b', 'feature/foo'], { cwd: dir });
  commitFile(dir, 'a.txt', 'hello');
  assert.equal(queryGitStatus(dir), 'feature/foo|0|0');
});

test('formatGitValue: 변경사항이 없으면 브랜치명만 표시한다', () => {
  assert.equal(formatGitValue('main|0|0'), '🌿 main');
});

test('formatGitValue: staged/modified가 있으면 +staged~modified 접미사가 붙는다', () => {
  assert.equal(formatGitValue('main|2|1'), '🌿 main +2~1');
});

test('formatGitValue: 슬래시가 들어간 브랜치명도 정확히 표시된다', () => {
  assert.equal(formatGitValue('feature/foo|0|0'), '🌿 feature/foo');
});

test('formatGitValue: 브랜치명 자체에 파이프(|)가 섞여 있어도 뒤에서부터 정확히 파싱한다(단순 split의 함정 회피)', () => {
  assert.equal(formatGitValue('weird|branch|name|3|1'), '🌿 weird|branch|name +3~1');
});

test('formatGitValue: 예상 밖 형식이 들어와도 크래시 없이 원문을 그대로 보여준다(방어적 폴백)', () => {
  assert.doesNotThrow(() => formatGitValue('garbage-no-pipes'));
  assert.equal(formatGitValue('garbage-no-pipes'), '🌿 garbage-no-pipes');
});

test('renderGit: session_id가 없으면 캐싱 없이 매번 직접 조회한다', () => {
  const dir = initTempRepo();
  execFileSync('git', ['checkout', '--quiet', '-b', 'no-cache-test'], { cwd: dir });
  commitFile(dir, 'a.txt', 'hello');
  assert.equal(renderGit({}, { cwd: dir }), '🌿 no-cache-test');
});

test('renderGit: git 저장소가 아니면 null을 반환한다(다른 위젯 렌더링에 영향 없음)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-not-a-repo-2-'));
  assert.equal(renderGit({ session_id: 'sess-1' }, { cwd: dir }), null);
});

test('renderGit: session_id가 있으면 TTL 안에는 캐시를 재사용한다(저장소 상태가 바뀌어도 캐시된 값을 그대로 보여줌)', () => {
  const original = process.env.CLAUDETOWER_CACHE_DIR;
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-git-cache-'));
  process.env.CLAUDETOWER_CACHE_DIR = cacheDir;
  try {
    const dir = initTempRepo();
    execFileSync('git', ['checkout', '--quiet', '-b', 'cache-test'], { cwd: dir });
    commitFile(dir, 'a.txt', 'hello');

    const first = renderGit({ session_id: 'sess-cache-1' }, { cwd: dir });
    assert.equal(first, '🌿 cache-test');

    // 저장소 상태를 바꿔도(새 파일 staged) TTL 안이면 캐시된 값 그대로 나와야 한다.
    fs.writeFileSync(path.join(dir, 'b.txt'), 'new', 'utf8');
    execFileSync('git', ['add', 'b.txt'], { cwd: dir });

    const second = renderGit({ session_id: 'sess-cache-1' }, { cwd: dir });
    assert.equal(second, '🌿 cache-test', '캐시가 재사용되지 않고 실시간 조회가 일어났다면 이 값이 달라져야 정상인데 달라지지 않음 = 캐시 재사용 증명');
  } finally {
    if (original === undefined) delete process.env.CLAUDETOWER_CACHE_DIR;
    else process.env.CLAUDETOWER_CACHE_DIR = original;
  }
});

test('renderGit: 캐시 쓰기가 부분 격리로 거부되는 상황이어도 실제 조회한 값은 정상 반환된다(2026-08-03 실제 exe 라이브 테스트로 발견한 결함의 회귀 테스트)', () => {
  const original = process.env.CLAUDETOWER_WIDGET_CONFIG_PATH;
  process.env.CLAUDETOWER_WIDGET_CONFIG_PATH = '/tmp/fake-widget-config.json'; // CLAUDETOWER_CACHE_DIR는 일부러 안 줌
  try {
    const dir = initTempRepo();
    execFileSync('git', ['checkout', '--quiet', '-b', 'partial-isolation-test'], { cwd: dir });
    commitFile(dir, 'a.txt', 'hello');
    const out = renderGit({ session_id: 'sess-partial-isolation-render' }, { cwd: dir });
    assert.equal(out, '🌿 partial-isolation-test'); // 캐시 저장이 막혀도 위젯 자체는 사라지면 안 됨
  } finally {
    if (original === undefined) delete process.env.CLAUDETOWER_WIDGET_CONFIG_PATH;
    else process.env.CLAUDETOWER_WIDGET_CONFIG_PATH = original;
  }
});

test('renderGit: 캐시가 만료되면 다시 직접 조회한다', () => {
  const original = process.env.CLAUDETOWER_CACHE_DIR;
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-git-cache-expiry-'));
  process.env.CLAUDETOWER_CACHE_DIR = cacheDir;
  try {
    const dir = initTempRepo();
    execFileSync('git', ['checkout', '--quiet', '-b', 'expiry-test'], { cwd: dir });
    commitFile(dir, 'a.txt', 'hello');

    // 이미 만료된 캐시 항목을 직접 심어둔다(60초 전 저장, TTL 5초 → 확실히 만료).
    const filePath = path.join(cacheDir, 'sess-expiry__git_status.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        session_id: 'sess-expiry',
        key: 'git_status',
        value: 'stale-branch|9|9',
        cached_at: new Date(Date.now() - 60_000).toISOString(),
        ttl_sec: 5,
      }),
      'utf8'
    );

    const out = renderGit({ session_id: 'sess-expiry' }, { cwd: dir });
    assert.equal(out, '🌿 expiry-test'); // 만료된 캐시(stale-branch)가 아니라 실제 저장소 상태
  } finally {
    if (original === undefined) delete process.env.CLAUDETOWER_CACHE_DIR;
    else process.env.CLAUDETOWER_CACHE_DIR = original;
  }
});
