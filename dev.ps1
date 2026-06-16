# MeetNote 개발 서버 시작
# 사용법: .\dev.ps1 [포트번호]  (기본 5175)

param(
    [int]$Port = 5175
)

Set-Location "$PSScriptRoot\app"
Write-Host "개발 서버 시작 중... http://localhost:$Port/MeetNote/" -ForegroundColor Cyan
npm run dev -- --port $Port --open
