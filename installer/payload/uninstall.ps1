# Go cai dat Quan ly Vu khi. MAC DINH GIU LAI du lieu: app\backend\data, app\backend\backups, app\backend\.env, logs.
#   -RemoveData : xoa luon ca du lieu (KHONG the khoi phuc)
#   -KeepTunnel : giu lai dich vu cloudflared
param([switch]$RemoveData, [switch]$KeepTunnel, [switch]$NoPause)
$ErrorActionPreference = 'Stop'
$Dir = $PSScriptRoot.TrimEnd('\')
. (Join-Path $Dir 'common.ps1')

try {
    Assert-Admin
    Write-Step 'Dung va go tac vu tu chay'
    Stop-App $Dir
    foreach ($t in $TaskNames) { Unregister-ScheduledTask -TaskName $t -Confirm:$false -ErrorAction SilentlyContinue }
    Get-NetFirewallRule -DisplayName $FirewallRule -ErrorAction SilentlyContinue | Remove-NetFirewallRule

    $cf = Join-Path $Dir 'bin\cloudflared.exe'
    $svcPath = Get-CloudflaredServicePath
    if (-not $KeepTunnel -and $svcPath -and ($svcPath -ieq $cf)) {
        Write-Step 'Go dich vu cloudflared'
        Invoke-Native $cf @('service', 'uninstall') | Out-Null
        Start-Sleep -Seconds 2
    }

    Write-Step 'Xoa file chuong trinh'
    foreach ($p in 'app\frontend', 'runtime', 'bin', 'app\backend\src', 'app\backend\node_modules',
                   'app\backend\package.json', 'app\backend\package-lock.json',
                   'run-backend.cmd', 'run-frontend.cmd', 'ChayApp.bat', 'DungApp.bat', 'install.ps1', 'CaiDat.bat', 'HuongDan.txt', 'tunnel-token.txt') {
        $full = Join-Path $Dir $p
        if (Test-Path $full) { Remove-Item $full -Recurse -Force -ErrorAction SilentlyContinue }
    }
    if ($RemoveData) {
        Remove-Item (Join-Path $Dir 'app') -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $Dir 'logs') -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host '    Da xoa ca du lieu.'
    } else {
        Write-Host "    Du lieu van giu tai: $Dir\app\backend\data (va backups, .env)"
    }
    Write-Host "`nDA GO CAI DAT." -ForegroundColor Green
    $exit = 0
} catch {
    Write-Host "`nLOI: $($_.Exception.Message)" -ForegroundColor Red
    $exit = 1
}
if (-not $NoPause) { Read-Host 'Nhan Enter de dong' | Out-Null }
exit $exit
