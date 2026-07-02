# ClaudeTower 설치 스크립트 (Windows, irm .../install.ps1 | iex)
#
# 주의: 이 저장소가 비공개(private)인 동안에는 GitHub Release 자산이
# 인증 없는 Invoke-WebRequest로 받아지지 않는다 — 저장소를 공개 전환하거나
# GitHub Release 자체를 아직 만들지 않은 상태에서는 이 스크립트가 실제로
# 동작하지 않는다(Phase 1 시점에는 스크립트 구조만 완성, 실다운로드 검증은
# 보류 — .PRD 참고).

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
Invoke-WebRequest -Uri $Url -OutFile $TargetPath

Write-Host ""
Write-Host "설치 완료: $TargetPath"
Write-Host "PATH에 추가하려면 다음 명령을 실행하세요(현재 사용자 PATH에 추가):"
Write-Host "  [Environment]::SetEnvironmentVariable('Path', `"`$env:Path;$InstallDir`", 'User')"
Write-Host "그 다음 새 터미널에서 'claudetower setup'을 실행하세요."
