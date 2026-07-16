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

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$TargetPath = Join-Path $InstallDir 'claudetower.exe'

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

Write-Host ""
Write-Host "설치 완료: $TargetPath"
Write-Host "PATH에 추가하려면 다음 명령을 실행하세요(현재 사용자 PATH에 추가):"
Write-Host "  [Environment]::SetEnvironmentVariable('Path', `"`$env:Path;$InstallDir`", 'User')"
Write-Host "그 다음 새 터미널에서 'claudetower setup'을 실행하세요."
