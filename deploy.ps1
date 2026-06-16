# MeetNote 커밋 + 배포 푸시 (mykim) + 백업 푸시 (origin)
# 사용법: .\deploy.ps1 [-Message "커밋 메시지"] [-BuildFirst] [-BackupOnly] [-SkipCommit]

param(
    [string]$Message = "",
    [switch]$BuildFirst,
    [switch]$BackupOnly,
    [switch]$SkipCommit
)

Set-Location "$PSScriptRoot"

# ── 빌드 검증 (옵션) ──
if ($BuildFirst) {
    Write-Host "빌드 검증 중..." -ForegroundColor Yellow
    Set-Location "$PSScriptRoot\app"
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { Write-Host "타입 오류. 배포 중단." -ForegroundColor Red; exit 1 }
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Host "빌드 실패. 배포 중단." -ForegroundColor Red; exit 1 }
    Write-Host "빌드 OK" -ForegroundColor Green
    Set-Location "$PSScriptRoot"
}

# ── Git 커밋 ──
if (-not $SkipCommit) {
    $status = git status --porcelain
    if (-not $status) {
        Write-Host "변경 사항 없음. 커밋 생략." -ForegroundColor Yellow
    } else {
        if (-not $Message) {
            $date = Get-Date -Format "yyyy-MM-dd HH:mm"
            $Message = "chore: update $date"
        }
        git add -A
        git commit -m $Message
        if ($LASTEXITCODE -ne 0) { Write-Host "커밋 실패." -ForegroundColor Red; exit 1 }
    }
}

# ── 푸시 ──
if (-not $BackupOnly) {
    Write-Host "배포 푸시 -> mykim (GitHub Pages)..." -ForegroundColor Cyan
    git push mykim main
    if ($LASTEXITCODE -ne 0) { Write-Host "mykim 푸시 실패." -ForegroundColor Red; exit 1 }
    Write-Host "배포 완료: https://mykim711231.github.io/MeetNote/" -ForegroundColor Green
}

Write-Host "백업 푸시 -> origin..." -ForegroundColor Cyan
git push origin main
if ($LASTEXITCODE -ne 0) { Write-Host "origin 푸시 실패." -ForegroundColor Red; exit 1 }

Write-Host "완료!" -ForegroundColor Green
