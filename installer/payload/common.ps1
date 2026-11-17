# Ham dung chung cho install.ps1 / uninstall.ps1 (chi ASCII de PowerShell 5.1 doc dung).

$TaskNames = @('QuanLyVuKhi-Backend', 'QuanLyVuKhi-Frontend')
$FirewallRule = 'QuanLyVuKhi Web 3000'

function Write-Step($msg) { Write-Host "`n=== $msg" -ForegroundColor Cyan }

function Assert-Admin {
    $p = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Can chay voi quyen Administrator (chuot phai > Run as administrator).'
    }
}

# Dung ung dung: chi dung dung cac tien trinh cua ban cai dat nay
# (node.exe nam trong <InstallDir>\runtime va cmd.exe dang chay run-*.cmd cua <InstallDir>).
function Stop-App([string]$Dir) {
    foreach ($t in $TaskNames) {
        if (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue) {
            Stop-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
        }
    }
    $node = Join-Path $Dir 'runtime\node.exe'
    $runBe = Join-Path $Dir 'run-backend.cmd'
    $runFe = Join-Path $Dir 'run-frontend.cmd'
    Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='cmd.exe'" | Where-Object {
        ($_.Name -eq 'node.exe' -and $_.ExecutablePath -and ($_.ExecutablePath -ieq $node)) -or
        ($_.Name -eq 'cmd.exe' -and $_.CommandLine -and
            ($_.CommandLine.IndexOf($runBe, [StringComparison]::OrdinalIgnoreCase) -ge 0 -or
             $_.CommandLine.IndexOf($runFe, [StringComparison]::OrdinalIgnoreCase) -ge 0))
    } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

# Duong dan exe cua dich vu cloudflared (neu co), vd C:\QuanLyVuKhi\bin\cloudflared.exe
function Get-CloudflaredServicePath {
    $svc = Get-CimInstance Win32_Service -Filter "Name='Cloudflared'" -ErrorAction SilentlyContinue
    if (-not $svc) { return $null }
    $p = $svc.PathName
    if ($p -match '^"([^"]+)"') { return $Matches[1] }
    return ($p -split ' ')[0]
}

# Chay lenh ngoai, in ra man hinh, khong de stderr lam dung script (PS 5.1).
function Invoke-Native([string]$Exe, [string[]]$Arguments) {
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $Exe @Arguments 2>&1 | ForEach-Object { Write-Host "    $_" } }
    finally { $ErrorActionPreference = $old }
    return $LASTEXITCODE
}
