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
Invoke-WebRequest -Uri $Url -OutFile $TargetPath

Write-Host ""
Write-Host "설치 완료: $TargetPath"
Write-Host "PATH에 추가하려면 다음 명령을 실행하세요(현재 사용자 PATH에 추가):"
Write-Host "  [Environment]::SetEnvironmentVariable('Path', `"`$env:Path;$InstallDir`", 'User')"
Write-Host "그 다음 새 터미널에서 'claudetower setup'을 실행하세요."
