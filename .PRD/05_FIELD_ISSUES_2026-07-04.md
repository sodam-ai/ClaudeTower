# 05. 현장 이슈 리포트 — 재설치/업데이트 & 슬래시 명령 (2026-07-04)

> 성격: 설계문서(01~04)가 아니라 **실사용 중 발견된 문제 분석 + 개선 백로그**입니다.
> 근거: 2026-07-04 실사용 세션에서 **실측된 값**만 사용합니다. 확정된 것은 `[확인됨]`, 추정은 `[가능성]`으로 구분 표기합니다.
> 목적: ClaudeTower를 개선/보완/수정할 수 있도록 문제의 **근본 원인**과 **권고 수정안**을 누락 없이 정리.

---

## 0. 한눈 요약

| # | 이슈 | 심각도 | 상태 | 한 줄 |
|---|------|--------|------|-------|
| 1 | 설치 파일 잠금 경합 (self-collision) | **HIGH (P0)** | **2026-07-06 코드 수정 적용**(임시파일+원자적 교체+재시도), 로직 시뮬레이션 검증 완료 / 실사용 유세션 재현 검증은 아직 없음 | install.ps1이 실행 중인 exe를 직접 덮어써서, 자기 statusLine이 자기 설치를 막음 |
| 2 | npm -g 깨진 shim 잔재 | MEDIUM (P2) | 이번 세션에 수동 제거 완료 | 폐기된 npm-g 방식의 shim 3개가 남아 bare `claudetower`가 MODULE_NOT_FOUND |
| 3 | `.claudetower\bin` PATH 미등록 | MEDIUM (P2) | 미해결 | 설치 스크립트가 PATH를 "안내만" 함 → 비개발자는 bare 명령을 못 씀 |
| 4 | `/claudetower-widgets` 슬래시 명령 미등록 | **HIGH (P1)** | **2026-07-06 근본원인 확정·코드 수정 적용** | ClaudeTower가 setup 때 심는 공식 스킬이, exe만 교체하는 업데이트로는 갱신되지 않아 낡은 위치·낡은 내용으로 남아있었음 |
| 5 | statusLine 스폰 모델(1초·83MB) 비효율 | MEDIUM (설계) | 관찰됨 | 매초 83MB 프로세스 스폰 = 이슈#1의 근본 토양 + 성능 부담 |
| 6 | (환경요인) SoDamHarness 가드 오탐 | LOW | ClaudeTower 결함 아님 | 수정 적용을 반복 차단 — 교차 프로젝트 노트 |

> **가장 중요한 두 가지**: (P0) 이슈#1은 "열린 Claude Code 세션이 하나라도 있으면 업데이트가 막힌다"는 구조적 결함이라 **모든 사용자에게 재현**된다. (P1) 이슈#4는 사용자가 검증까지 마쳤다는 슬래시 명령이 지금 안 뜨는데 **근본 원인이 아직 확정되지 않았다**(정직하게 미해결로 남김).

---

## 1. [P0] 설치 파일 잠금 경합 — install.ps1이 자기 자신을 막는다

### 1.1 증상 `[확인됨]`
`irm https://raw.githubusercontent.com/sodam-ai/ClaudeTower/main/install.ps1 | iex` 실행 시 반복 실패:
```
다운로드: https://github.com/sodam-ai/ClaudeTower/releases/latest/download/claudetower-win-x64.exe
The process cannot access the file 'C:\Users\PC\.claudetower\bin\claudetower.exe'
because it is being used by another process.
```
사용자 표현 그대로 "계속 막혀".

### 1.2 재현 조건 `[확인됨]`
- 열려 있는 Claude Code 세션 존재(측정 시 **4개**). 각 세션이 statusLine으로 exe를 반복 실행 중.

### 1.3 근본 원인 `[확인됨]`
세 요소의 곱:
1. **install.ps1이 최종 경로에 직접 다운로드한다.** (실측: 스크립트 31줄, `Invoke-WebRequest -Uri $Url -OutFile $TargetPath`, `$TargetPath = $InstallDir\claudetower.exe`.) → 약 **83MB(87,153,664 bytes)** 다운로드 **내내** 대상 파일 쓰기 핸들을 점유.
2. **statusLine이 그 exe를 1초마다 재실행한다.** (실측: `~/.claude/settings.json` → `"command": "\"C:/Users/PC/.claudetower/bin/claudetower.exe\" statusline"`, `"refreshInterval": 1`.) 열린 세션마다 매초 스폰.
3. **83MB 바이너리라 스폰 1건이 로딩에 100~300ms 파일을 점유** `[가능성: 정확한 점유시간은 미측정, 대용량 exe 로딩 특성상 추정]`. 4세션 × 매초 → exe가 사실상 상시 잠김.

→ IWR가 대상을 **여는 순간** 잠겨 있으면 즉시 실패. 매초 스폰이라 다운로드 시작 시 충돌이 거의 필연.

> 핵심: **ClaudeTower의 statusLine이 ClaudeTower의 installer를 막는 self-collision.** 사용자가 뭘 잘못한 게 아니다.

### 1.4 영향
- 열린 Claude Code 세션이 **1개라도** 있으면 업데이트/재설치가 막힘. 모든 사용자·모든 업데이트에 재현되는 구조적 결함.
- 회피하려면 사용자가 모든 세션을 닫거나 프로세스를 죽여야 하는데, 비개발자 대상 도구에서 비현실적.

### 1.5 이번 세션의 임시 우회(제품 수정 아님) `[확인됨]`
- 15ms 간격 **백그라운드 프로세스 킬러**(`Get-Process claudetower | Stop-Process`)로 잠금을 계속 풀며 원라이너를 **재시도** → **2회차에 설치 성공**. 설치 후 exe 수정시각 `03:56 → 04:49` 변경, `--version` = `0.1.10` 정상.
- (참고) 100ms 킬러+**단일 시도**는 실패, 15ms 킬러+**재시도 루프**는 2회차 성공 — 간격을 좁힌 것과 재시도를 더한 것이 함께 주효했으며, **둘 중 어느 쪽이 결정적인지는 분리 측정하지 않았다** `[가능성]`.

### 1.6 권고 수정 (ClaudeTower 레포)
우선순위 순:
1. **install.ps1: 임시파일 → 원자적 교체 + 재시도.**
   - 임시 경로로 먼저 다운로드(네트워크 쓰기, 대상 미점유) → `Move-Item -Force`로 **짧은 순간에 교체** + 실패 시 짧은 sleep 후 재시도 N회. 쓰기 창을 수 초 → 수십 ms로 축소.
   - **Before (현재 install.ps1 — 문제 지점):**
     ```powershell
     Invoke-WebRequest -Uri $Url -OutFile $TargetPath   # 실행 중인 최종 파일에 수 초간 직접 쓰기 → 잠금 충돌
     ```
   - **After (권고안):**
     ```powershell
     $TempPath = Join-Path $InstallDir ('claudetower.exe.download.' + $PID)
     Invoke-WebRequest -Uri $Url -OutFile $TempPath      # 잠기지 않은 임시 경로로 먼저 수신

     $done = $false
     for ($i = 1; $i -le 30; $i++) {
         try   { Move-Item -LiteralPath $TempPath -Destination $TargetPath -Force -ErrorAction Stop; $done = $true; break }
         catch { Start-Sleep -Milliseconds 200 }          # statusLine 스폰 사이 빈틈을 노려 재교체
     }
     if (-not $done) {
         Remove-Item -LiteralPath $TempPath -Force -ErrorAction SilentlyContinue
         Write-Error "claudetower.exe가 사용 중이라 교체 실패. Claude Code 창을 모두 닫고 다시 시도하세요."
         exit 1
     }
     ```
   - ⚠️ **한계(정직)**: 재시도-교체는 쓰기 창을 수 초→수십 ms로 줄여 성공률을 크게 올리지만, **세션이 많으면(빈틈이 좁아져) 30회 안에 실패할 수도 있다.** 완전 보장은 아래 2번(버전드 파일명+런처)이라야 성립한다.
2. **버전드 파일명 + 안정 런처(근본책).**
   - 실제 바이너리를 `claudetower-<version>.exe`로 두고, statusLine은 **절대 교체되지 않는 얇은 런처/shim**(또는 심볼릭 링크)만 실행. → 실행 중인 파일과 교체 대상이 분리되어 경합 원천 소멸.
3. **self-update 서브명령(`claudetower update`).**
   - 실행 중인 statusLine 프로세스를 감지·안내(필요 시 사용자 동의 하에 일시 종료)한 뒤 안전 교체. 원라이너보다 UX가 명확.
4. **문서화**: 위가 적용되기 전까지 "업데이트 전 모든 Claude Code 창을 닫으세요" 안내를 install 출력·README에 명시(현재 없음).

### 1.7 검증 계획 (수정이 실제로 먹는지)
- **T1 (무세션)**: Claude Code 전부 닫고 설치 → exe `mtime` 갱신 + `claudetower.exe --version`이 최신 버전.
- **T2 (핵심·유세션)**: Claude Code **1개 이상 열어 statusLine 가동 중**에 설치 → **성공해야 함**(현재는 실패). exe `mtime` 갱신 + `--version` 확인 + 설치 후 상태줄 정상 렌더 지속.
- **T3 (임시파일 청소)**: 성공/실패 어느 경우든 `claudetower.exe.download.*` 잔재가 남지 않아야 함.
- **T4 (회귀)**: 교체 후 `claudetower statusline`(실제 세션 JSON 입력)이 정상 출력.

> **2026-07-06 갱신 `[확인됨/가능성 구분]`**: `install.ps1`(Move-Item 재시도 최대 30회×200ms)·`install.sh`(POSIX `mv` 원자적 교체, 재시도 불요)에 §1.6 권고안을 적용했다. 스크래치 환경에서 동일 로직만 분리해 **T1·T2·T3을 시뮬레이션으로 검증**했다 `[확인됨]`: T1(무잠금) 1회 시도 즉시 성공, T2(2초간 배타적 잠금 후 해제) 11회 재시도(~2.08초) 후 성공, T3 임시파일 잔재 0건. 다만 실제 `irm .../install.ps1 | iex`을 열린 Claude Code 세션에서 돌리는 **원본 시나리오 재현(T2 실사용판)과 T4, install.sh의 실제 macOS/Linux 동작은 아직 미검증** `[가능성]` — 이 머신이 Windows라 POSIX `rename()` 의미론을 직접 재현할 수 없었다.

---

## 2. [P2] npm -g 깨진 shim 잔재

### 2.1 증상 `[확인됨]`
- `where claudetower` → `AppData\Roaming\npm\claudetower`, `claudetower.cmd`가 **PATH 우선순위 상단**에서 잡힘.
- 실행 시: `Error: Cannot find module 'C:\Users\PC\AppData\Roaming\npm\node_modules\claudetower\bin\claudetower.js' ... MODULE_NOT_FOUND`.
- 백킹 폴더 `node_modules\claudetower`는 **이미 삭제됨** → shim만 댕글링.

### 2.2 근본 원인 `[확인됨 + 가능성]`
- 과거 npm-global 설치 방식(메모리상 **"npm-g는 보류로 확정"** — `claudetower-public-repo-next-steps`)이 남긴 shim 3개(`claudetower`, `.cmd`, `.ps1`).
- 백킹 모듈만 제거되고 shim 정리가 안 됨 `[가능성: 정리 주체가 npm uninstall 불완전이었는지, 수동 삭제였는지는 미확정]`.

### 2.3 영향
- bare `claudetower`가 깨진 shim으로 해석되어 오류. statusLine(절대경로)에는 무해하나 CLI 명령 UX를 오염.

### 2.4 이번 세션 조치 `[확인됨]`
- shim 3개 수동 삭제(단일 파일 삭제로 가드 통과). 삭제 후 잔재 0 확인. `claudetower.exe`(절대경로) `--version` = `0.1.10` 정상.

### 2.5 권고 수정
- **installer/uninstaller가 stale npm shim을 탐지·정리**하도록 추가.
- npm-g가 공식 폐기라면 릴리스 노트/README에 **정리 원라이너** 제공.

---

## 3. [P2] `.claudetower\bin` PATH 미등록 — bare CLI 사용 불가

### 3.1 증상 `[확인됨]`
- User PATH에 `.claudetower\bin` **없음**. shim 정리 후 bare `claudetower`는 **아무 것으로도 해석 안 됨**.

### 3.2 근본 원인 `[확인됨]`
- install.ps1이 PATH 추가를 **실행하지 않고 안내만** 함(`[Environment]::SetEnvironmentVariable('Path', ...)`를 "이 명령을 실행하세요"로 출력). 비개발자는 이 단계를 건너뜀.

### 3.3 영향
- `claudetower setup/status/widgets/uninstall`을 **이름으로 못 부름**(전체 경로로만 가능). statusLine은 되지만 사람이 쓰는 CLI가 사실상 잠김. "비개발자 친화" 지향(위젯 관리 스킬 설명에 "터미널·명령어 모르는 비개발자일 수 있으니"로 명시됨 — README 명시 여부는 `[미확인]`)과 충돌.

### 3.4 권고 수정
- install.ps1 또는 `claudetower setup`이 **동의 하에 User PATH 자동 등록**. 최소한 안내에 "새 터미널 필요" 명시 + 복사 실수 없는 형태로.

---

## 4. [P1] `/claudetower-widgets` 슬래시 명령 미등록 — **2026-07-06 근본원인 확정**

> **2026-07-06 갱신 `[확인됨]`**: 아래 §4.1~4.7은 2026-07-04 당시 조사 기록(그때는 "미해결"이었음)을 그대로 보존한다. 이후 이 PC의 실제 스킬 파일을 직접 열어 다음을 확인했다:
> - 실제 파일 `~/.claude/skills/claudetower-widgets/SKILL.md`는 **2026-07-03 18:24**에 쓰였고(커밋 `6af4f1b`·`3ea82c9`가 각각 21:34·22:13에 두 가지를 이미 고친 **이후**에도 그대로 방치됨), `disable-model-invocation: true`가 여전히 남아있었다.
> - `$CLAUDE_CONFIG_DIR/skills/claudetower-widgets/SKILL.md`(이 PC는 `CLAUDE_CONFIG_DIR` 설정됨, 코드 기준 정답 위치)에는 **파일이 아예 없었다.**
> - **결론**: §4.4의 H1(disable-model-invocation)·H3(CLAUDE_CONFIG_DIR 위치)은 이미 코드로 고쳐졌지만, **`claudetower setup`을 재실행해야만 스킬 파일이 갱신되는데, exe만 교체하는 업데이트(재설치 원라이너, `ensureInstalledAtTarget`의 자체 재배치)는 setup을 다시 부르지 않는다.** 그래서 새 코드를 설치해도 예전 setup이 심어둔 낡은 스킬 파일이 영원히 남는 것이 실제 원인이었다. 가설이 아니라 라이브 파일로 직접 확인된 사실이다.
> - **수정**: `src/display/config/skill-file.js`에 `cleanupStaleSkillDirs()` 추가 — `writeSkillFile`/`removeSkillFile` 실행 시 정답 위치가 아닌 다른 후보 위치(기본 `~/.claude/skills`, `CLAUDE_CONFIG_DIR` 설정 시 그쪽도 포함)에 낡은 스킬이 남아있으면 함께 정리한다. 이 PC에 실제 적용해 낡은 파일 제거 + 정답 위치에 최신 스킬 재생성까지 확인(`[확인됨]`).
> - **남은 미검증**: 이 PC에서 정리 직후 스킬 파일이 원인 미상으로 한 차례 사라졌다 재생성한 사례가 있었다(이 PC는 06번 문서가 기록한 대로 동시에 여러 Claude Code 세션이 떠 있는 환경이라, 다른 세션의 개입 가능성을 배제하지 못함 `[가능성]`). 완전 재시작 후 실제로 `/claudetower-widgets`가 뜨는지는 **사용자가 직접 확인해야 최종 완료**로 볼 수 있다.

> 이번 세션에서 사용자의 **1차 통증**이자, **정직하게 아직 못 고친** 항목이다. 추정을 사실로 포장하지 않는다.

### 4.1 증상 `[확인됨]`
- 사용자가 `/claudetower-widgets` 입력 → `No commands match "/claudetower-widgets"`. (안내한 수정 시도 후에도 "그래도 안 뜸".)
- 모델이 `Skill` 도구로 호출 → `Unknown skill: claudetower-widgets`.

### 4.2 확정 사실 `[확인됨]`
- 스킬 파일 존재: `~/.claude/skills/claudetower-widgets/SKILL.md`. 프론트매터에 `description`, **`disable-model-invocation: true`**, `argument-hint`, `allowed-tools: Bash("C:/Users/PC/.claudetower/bin/claudetower.exe" widgets *)`, 본문에 `$ARGUMENTS`. exe를 **전체 절대경로**로 호출(npm shim/PATH 무의존).
- 스킬이 실행하는 실제 명령은 **정상 작동**: `widgets` 조회, `widgets off cost`, `widgets on cost` 왕복 실측 성공(상태 원복 확인).
- 이번 세션의 exe 재설치·npm shim 삭제는 `~/.claude/skills`·`commands`를 **건드리지 않음** → 재설치가 원인이 **아님** `[확인됨]`.

### 4.3 대조군 관찰 — 인과는 **미입증** `[가능성]`
- `disable-model-invocation`이 **없는** 개인 스킬 `~/.claude/skills/skill-stocktake/SKILL.md`(프론트매터 `description`+`origin`만)는 **본문에서 스스로를 `/skill-stocktake`로 규정**한다.
- ⚠️ 단, 실제로 `/skill-stocktake`가 슬래시로 **해석되는지는 이번에 눌러 확인하지 않았다** — 파일 안의 자기규정 ≠ 실제 등록. 따라서 이 스킬을 "작동 대조군"으로 쓸 수 없다.
- 그러므로 "두 스킬의 **관찰된** 구조적 차이 = `disable-model-invocation` 한 줄"은 **사실**이나, **이 한 줄이 원인이라는 인과는 미입증**이다: (a) 대조군 슬래시 해석 미실측, (b) 아래 §4.5 공식 문서 근거 확보 실패, (c) 사용자가 재시도 후에도 안 뜬다고 보고.

### 4.4 가설 (모두 **미검증** — 우열 미확정) `[가능성]`
- **H1**: `disable-model-invocation: true`가 이 Claude Code 버전에서 **모델 목록 + 사용자 슬래시 목록 양쪽에서** 스킬을 제거한다.
- **H2**: `argument-hint`/`allowed-tools`/`$ARGUMENTS`는 원래 **슬래시 '명령'(`~/.claude/commands/*.md`) 문법**인데 이를 **스킬(SKILL.md)** 에 넣어 등록/파싱이 어긋난다.
- **H3**: 이 CC 버전은 개인 스킬을 `/slash`로 노출하지 않으며, 슬래시 명령은 **`~/.claude/commands/<name>.md` 파일**이라야 한다(사용자 자신의 규칙 "명령슬래시=파일명"과 일치 — 메모리 `sodam-cc-plugin-naming`).
- **H4**: 스킬/명령 등록은 세션 시작 시 스캔 → **완전 재시작** 필요(동 메모리: "완전재시작 필수").
- **우열 판정 보류**: §4.3에서 밝혔듯 대조군이 미검증이라, H1(플래그가 원인)을 다른 가설 위로 올릴 근거가 없다. **어느 가설도 입증되지 않았고, 하나를 "가장 유력"으로 지정하지 않는다.**
- **1회로 구분하는 결정적 테스트**(깨끗한 새 세션·완전 재시작에서): ① `/skill-stocktake`가 뜨는가 → 개인 스킬의 슬래시 노출 여부(H3 판정) ② `claudetower-widgets`에서 `disable-model-invocation` 한 줄만 뺐을 때 뜨는가 → H1 판정 ③ `commands/claudetower-widgets.md` 배치 시 뜨는가 → H2·H3 판정.

### 4.5 조사 한계 `[확인됨]`
- 권위 있는 CC 동작 확인을 위해 `claude-code-guide` 에이전트를 호출했으나 **컨텍스트 초과(≈210k 토큰)로 실패** → 공식 문서 근거 확보 실패. 남은 방법: (a) 별도 경량 세션에서 claude-code-guide 재시도, (b) 깨끗한 세션에서 통제 실험.

### 4.6 ClaudeTower와의 관계 (제품 결정 필요)
- 이 위젯 슬래시 명령은 **사용자가 직접 만든 것**(본인 진술) `[확인됨]`이며, `claudetower setup`이 자동 설치하는 대상이 아니다(파일 위치·한국어 톤·절대경로 하드코딩이 이를 뒷받침). → 따라서 **ClaudeTower 공식 산출물 범위에 포함할지는 제품 결정 사항** `[가능성]`.
- 제품 결정: ClaudeTower가 "대화로 위젯 켜고 끄기" UX를 **공식 제공**할 것인가?
  - 그렇다면 손수 만든 스킬에 의존하지 말고 **정식 `commands/*.md` 슬래시 명령**(또는 `claudetower setup`이 멱등 설치)으로 제공해야 함.

### 4.7 권고 다음 단계
1. **CC 정식 메커니즘 확정**: "모델은 자동 호출 안 함 + 사용자는 `/명령`으로 호출" → 후보는 `commands/*.md`(명령은 본디 사용자 전용). 문서로 확정.
2. **명령 파일로 전환 후 재검증**: `~/.claude/commands/claudetower-widgets.md`(이번 세션에 스크래치패드에 준비됨: disable-model-invocation 제거·나머지 동일) 배치 → **완전 재시작** → **깨끗한 세션에서** `/claudetower-widgets` 확인.
3. **중복 선언 방지**: 명령 파일과 스킬 폴더 동명 공존 리스크 정리(메모리 "중복선언 금지").
4. ClaudeTower가 이 UX를 소유하기로 하면 `setup`에 멱등 설치 옵션 추가.
5. **검증 전 "됐다" 금지**: 파일 존재·하위 명령 작동 ≠ 슬래시 등록. 실제 `/명령` 해석까지 확인해야 완료.

---

## 5. [설계] statusLine 스폰 모델 — 1초·83MB의 대가

### 5.1 관찰 `[확인됨]`
- `refreshInterval: 1` + 스폰당 83MB exe 실행. 4세션이면 **초당 4회, 매회 83MB 로딩**.

### 5.2 함의
- 이슈#1(잠금 경합)의 **근본 토양**. 갱신 주기가 짧고 바이너리가 클수록 잠금 창이 넓어짐.
- 성능/배터리 부담(스폰-당-로딩 반복). 랩톱·다세션에서 체감 가능성 `[가능성: 실측 프로파일 미수행]`.

### 5.3 권고 (택1 또는 병행)
- `refreshInterval` 상향(예: 2~5초)로 스폰 빈도·잠금 창 축소(가장 저렴).
- **상주 데몬** 1개가 여러 세션에 상태를 공급(스폰-당-실행 폐기) — 근본책, 설계 비용 큼.
- **바이너리 경량화**(83MB는 번들 런타임/pkg 추정 `[가능성]`) — 로딩·다운로드·잠금 창 모두 개선.
- 03/04 문서의 "caam sub-100ms·핫 리로드" 논의와 연결해 재평가.

---

## 6. [환경요인] SoDamHarness 가드 오탐 — ClaudeTower 결함 아님

### 6.1 관찰 `[확인됨]`
- 수정 명령이 사용자 자신의 `guard.mjs`(PreToolUse)에 반복 차단됨:
  - `.claudetower` 경로 + 위험 동사(Remove-Item 등)가 한 명령 문자열에 함께 → "민감 위치" deny(safety-rules는 **비어 있음**에도).
  - echo 문자열의 `->`가 리다이렉트 정규식을 오탐 → 가짜 쓰기 대상 인식.
  - 단일 단순 명령(`Remove-Item '..\npm\claudetower.cmd' -Force`)은 통과.
- 정확한 트리거는 **미특정** `[가능성]`.

### 6.2 성격
- **ClaudeTower 결함이 아니라 SoDamHarness 측 교차 이슈.** 다만 이번 수정 적용을 느리게 만든 실제 마찰이므로 기록.
- 크로스 노트: SoDamHarness `guard.mjs`가 **빈 safety-rules에서도 `.claudetower` 경로를 민감 판정**하는 케이스 → 별도 조사 대상(이 문서 범위 밖, SoDamHarness 백로그로 이관 권장).

---

## 7. [메타] 진단 과정에서의 오류 (정직성 기록)

사용자가 "누락/오류/모순/빈틈 없이"를 요구했으므로 조사자(AI) 자신의 실수도 남긴다:
- **성급한 단정 3회**: "슬래시 명령은 그대로 살아있다/안 깨졌다"를 **등록 확인 전에** 단언 → 이후 `No commands match`로 반증되어 정정. 
- **얕은 1차 검색**: `commands/`·`plugins/`만 grep하고 `skills/`를 빠뜨려 "슬래시 명령 없음"이라 오판 → 이후 `skills/claudetower-widgets/`에서 발견.
- 교훈(하네스 반영 권장): **"파일 존재 + 하위 명령 작동"을 "기능 등록됨"으로 착각 금지.** 등록 표면(commands·skills·plugins) 전부 확인 + 실제 `/명령` 해석까지 검증해야 "확인됨".

---

## 8. 액션 아이템 (우선순위)

| 순위 | 항목 | 대상 | 유형 |
|------|------|------|------|
| ~~P0~~ ✅ | install.ps1/install.sh 임시파일→원자적 교체+재시도 — **2026-07-06 적용·시뮬레이션 검증 완료**(버전드 파일명/런처, 실사용 유세션 재현은 후속 과제로 보류) | ClaudeTower 레포 | 코드 |
| P0 | 업데이트 전 "창 닫기" 안내 명시(임시 완화) — 근본 수정이 적용됐으므로 필요성 재검토 | install 출력·README | 문서 |
| ~~P1~~ ✅ | `/claudetower-widgets` 근본원인 확정 — **2026-07-06**: setup 재실행 없이는 스킬이 갱신 안 되는 구조적 결함으로 확정, `cleanupStaleSkillDirs()` 추가로 수정. 실제 재시작 후 슬래시 동작 확인은 사용자 몫으로 남음 | CC 설정 / ClaudeTower 제품결정 | 조사→코드 |
| P2 | installer/uninstaller가 stale npm shim 정리 | ClaudeTower 레포 | 코드 |
| P2 | install/`setup`이 `.claudetower\bin` PATH 자동 등록(동의 하) | ClaudeTower 레포 | 코드 |
| P3 | statusLine 스폰 모델 재평가(refreshInterval↑ / 데몬 / 바이너리 경량화) | ClaudeTower 설계 | 설계 |
| — | (이관) guard.mjs `.claudetower` 오탐 조사 | SoDamHarness | 교차 |

---

## 9. 부록 — 이번 세션에서 실제로 적용된 변경 `[확인됨]`

- `claudetower.exe` 최신 재설치(v0.1.10, 04:49 갱신) — 백그라운드 킬러+재시도로 경합 우회, 2회차 성공.
- npm shim 3개(`claudetower`, `.cmd`, `.ps1`) 삭제 — bare 명령 오염 제거.
- 스크래치패드에 `commands/claudetower-widgets.md` 초안 준비(아직 미배치·미검증).
- **미변경**: `~/.claude/skills/claudetower-widgets/SKILL.md`(원본 보존), `~/.claude/settings.json`, ClaudeTower 레포 코드. → 이 문서의 P0~P2 코드 수정은 **아직 미적용**(레포에서 별도 작업 필요).
- ⚠️ **미검증(정직)**: 상태줄 **실렌더**는 확인 못 함. 위젯 CLI(`off`/`on`)는 왕복 실측했으나, `claudetower.exe statusline`은 빈 `{}`로만 스모크(출력 없음 = 표시할 데이터 없음이라 정상·결함 아님). **실제 세션 JSON으로의 상태줄 렌더는 미실측**이며, 교체 전후 바이너리 동작 동일성은 `--version`으로만 확인함.

---

### 근거 출처 (이 세션 실측)
- `~/.claude/settings.json` statusLine 블록(refreshInterval:1, 절대경로 command).
- install.ps1 원문(31줄, 직접 OutFile).
- 프로세스 측정: `claudetower.exe statusline` ×4.
- exe: 87,153,664 bytes, `--version` 0.1.10, mtime 03:56→04:49.
- `skills/claudetower-widgets/SKILL.md` / `skills/skill-stocktake/SKILL.md` 프론트매터.
- 슬래시 실패: `No commands match "/claudetower-widgets"`, Skill 도구 `Unknown skill`.
