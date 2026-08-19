# ClaudeTower 설치 스크립트 (Windows, irm .../install.ps1 | iex)
#
# 2026-07-04: 저장소 공개 전환 + main 브랜치 개설 + v0.1.9 릴리스로
# 원라이너 설치(irm https://raw.githubusercontent.com/sodam-ai/ClaudeTower/main/install.ps1 | iex)
# 가 실제로 동작하는 것을 실측 확인했다.

$ErrorActionPreference = 'Stop'

$Repo = 'sodam-ai/ClaudeTower'
$InstallDir = if ($env:CLAUDETOWER_INSTALL_DIR) { $env:CLAUDETOWER_INSTALL_DIR } else { "$env:USERPROFILE\.claudetower\bin" }

# 현재 CI 매트릭스는 win-x64만 빌드한다(.github/workflows/build.yml).
if ([System.Environment]::Is64BitOperatingSystem -eq $false) {
    Write-Error "현재 64비트 Windows만 지원합니다."
    exit 1
}

$Artifact = 'claudetower-win-x64.exe'
$Url = "https://github.com/$Repo/releases/latest/download/$Artifact"

# M38: credential-store(계정 등록 등)가 실제로 동작하려면 exe와 같은 폴더에 네이티브
# addon(keyring-native.node)이 반드시 함께 있어야 한다(process.dlopen 우회 로딩,
# src/accounts/credential-store/index.js 참고). 이 파일 없이 exe만 설치되면 status/
# widgets 같은 Display 기능은 멀쩡히 동작하지만 accounts add 등은 조용히 깨진다.
$NativeArtifact = 'keyring-native-win-x64.node'
$NativeUrl = "https://github.com/$Repo/releases/latest/download/$NativeArtifact"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$TargetPath = Join-Path $InstallDir 'claudetower.exe'
$NativeTargetPath = Join-Path $InstallDir 'keyring-native.node'

Write-Host "다운로드: $Url"

# .PRD/05_FIELD_ISSUES_2026-07-04.md 이슈#1(P0): 예전엔 여기서 바로 $TargetPath에
# Invoke-WebRequest -OutFile을 썼는데, statusLine이 그 파일을 1초마다 실행 중이면
# "다운로드하는 몇 초 내내" 대상 파일 쓰기 핸들을 붙잡고 있어 거의 항상 잠금
# 충돌로 실패했다(열린 Claude Code 세션이 하나라도 있으면 재현). 아무도 실행하지
# 않는 임시 경로로 먼저 받고, 실제 교체는 밀리초 단위 Move-Item 한 번으로 끝내
# 잠금 충돌 창을 "다운로드 전체 시간"에서 "rename 한 번"으로 줄인다.
$TempPath = Join-Path $InstallDir ('claudetower.exe.download.' + $PID)
Invoke-WebRequest -Uri $Url -OutFile $TempPath

$replaced = $false
$maxAttempts = 30
for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    try {
        Move-Item -LiteralPath $TempPath -Destination $TargetPath -Force -ErrorAction Stop
        $replaced = $true
        break
    } catch {
        if ($attempt -lt $maxAttempts) {
            Start-Sleep -Milliseconds 200
        }
    }
}
if (-not $replaced) {
    Remove-Item -LiteralPath $TempPath -Force -ErrorAction SilentlyContinue
    Write-Error "claudetower.exe가 사용 중이라 교체하지 못했습니다. 열려 있는 Claude Code 창을 모두 닫고 다시 시도해주세요."
    exit 1
}

Write-Host "다운로드: $NativeUrl"
# 이 파일은 statusLine처럼 매초 실행되지 않아 잠금 경합 가능성은 exe보다 훨씬 낮지만,
# accounts add 등이 실행 중이면 네이티브 addon이 dlopen으로 로드된 채 잠길 수 있어
# 같은 원자적 교체+재시도 원칙을 그대로 적용한다(이 프로젝트 관례, 05_FIELD_ISSUES 이슈#1).
$NativeTempPath = Join-Path $InstallDir ('keyring-native.node.download.' + $PID)
Invoke-WebRequest -Uri $NativeUrl -OutFile $NativeTempPath

$nativeReplaced = $false
for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    try {
        Move-Item -LiteralPath $NativeTempPath -Destination $NativeTargetPath -Force -ErrorAction Stop
        $nativeReplaced = $true
        break
    } catch {
        if ($attempt -lt $maxAttempts) {
            Start-Sleep -Milliseconds 200
        }
    }
}
if (-not $nativeReplaced) {
    Remove-Item -LiteralPath $NativeTempPath -Force -ErrorAction SilentlyContinue
    Write-Error "keyring-native.node가 사용 중이라 교체하지 못했습니다. 열려 있는 Claude Code 창을 모두 닫고 다시 시도해주세요."
    exit 1
}

Write-Host ""
Write-Host "설치 완료: $TargetPath"
Write-Host "PATH에 추가하려면 다음 명령을 실행하세요(현재 사용자 PATH에 추가):"
Write-Host "  [Environment]::SetEnvironmentVariable('Path', `"`$env:Path;$InstallDir`", 'User')"
Write-Host "그 다음 새 터미널에서 'claudetower setup'을 실행하세요."
