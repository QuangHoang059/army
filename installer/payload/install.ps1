# Cai dat he thong Quan ly Vu khi tren may chu Windows - CHAY TAI CHO (thu muc chua file nay),
# khong sao chep di dau. Giai nen vao noi muon dat co dinh roi moi chay.
#  - ALLOWED_IPS: GIU NGUYEN gia tri dang co trong app\backend\.env. Chi tu lay dai mang dau tien khi
#    chua co (lan cai dau), hoac ghi de khi truyen -AllowedIps.
#  - KHONG tu chay khi bat may, KHONG tu khoi dong lai: chay/chay lai bang ChayApp.bat, dung bang DungApp.bat
#  - Mo tuong lua cong 3000 cho may trong mang LAN
#  - Cai dich vu cloudflared (tunnel) bang token trong tunnel-token.txt
#
# Dung:  CaiDat.bat   (hoac)   powershell -ExecutionPolicy Bypass -File install.ps1 [-AllowedIps "10.0.0.0/8"] [-NoTunnel]
param(
    [string]$Token = '',
    [string]$AllowedIps = '',   # de trong = giu gia tri dang co trong .env (chua co thi tu lay mang dau tien)
    [switch]$NoTunnel,
    [switch]$NoPause
)
$ErrorActionPreference = 'Stop'
$InstallDir = $PSScriptRoot.TrimEnd('\')
. (Join-Path $InstallDir 'common.ps1')
New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir 'logs') | Out-Null
Start-Transcript -Path (Join-Path $InstallDir 'logs\install.log') -Append | Out-Null

function Get-FirstNetworkCidr {
    # Card mang "dau tien" = card co route mac dinh (0.0.0.0/0) uu tien cao nhat.
    $routes = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Sort-Object { $_.RouteMetric + (Get-NetIPInterface -InterfaceIndex $_.ifIndex -AddressFamily IPv4).InterfaceMetric }
    $idx = @($routes | ForEach-Object { $_.ifIndex }) +
           @(Get-NetAdapter | Where-Object Status -eq 'Up' | Sort-Object ifIndex | ForEach-Object { $_.ifIndex })
    foreach ($i in $idx) {
        $a = Get-NetIPAddress -InterfaceIndex $i -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '127.0.0.1' } | Select-Object -First 1
        if ($a) {
            $len = [int]$a.PrefixLength
            $b = ([Net.IPAddress]$a.IPAddress).GetAddressBytes(); [Array]::Reverse($b)
            $ip = [BitConverter]::ToUInt32($b, 0)
            $mask = [uint32]([math]::Pow(2, 32) - [math]::Pow(2, 32 - $len))
            $nb = [BitConverter]::GetBytes([uint32]($ip -band $mask)); [Array]::Reverse($nb)
            $alias = (Get-NetAdapter -InterfaceIndex $i -ErrorAction SilentlyContinue).Name
            return [pscustomobject]@{ Cidr = "$(([Net.IPAddress]$nb).IPAddressToString)/$len"; Ip = $a.IPAddress; Adapter = $alias }
        }
    }
    return $null
}

try {
    Assert-Admin
    Write-Host "Cai dat tai cho: $InstallDir"
    if ($InstallDir -like "$env:TEMP*" -or $InstallDir -match '\\Temp\\') {
        throw 'Dang chay trong thu muc tam (vd mo truc tiep tu file zip). Hay giai nen ra noi dat co dinh roi chay lai.'
    }

    if (-not $NoTunnel -and -not $Token) {
        $tf = Join-Path $InstallDir 'tunnel-token.txt'
        if (Test-Path $tf) { $Token = ([IO.File]::ReadAllText($tf)).Trim() }
    }

    # 1. Dung ban dang chay (neu chay lai CaiDat.bat)
    Write-Step 'Dung ung dung dang chay (neu co)'
    Stop-App $InstallDir

    # 2. ALLOWED_IPS
    Write-Step 'Cau hinh ALLOWED_IPS'
    $envFile = Join-Path $InstallDir 'app\backend\.env'
    if (Test-Path $envFile) {
        $lines = @([IO.File]::ReadAllLines($envFile))
    } else {
        $lines = @('PORT=4000', 'DB_PATH=./data/army.db', 'CORS_ORIGIN=http://localhost:3000')
    }
    $current = $lines | Where-Object { $_ -match '^\s*ALLOWED_IPS\s*=' } | Select-Object -Last 1
    if (-not $AllowedIps -and $current) {
        Write-Host "    Giu nguyen cau hinh dang co: $($current.Trim())"
    } else {
        if (-not $AllowedIps) {
            $net = Get-FirstNetworkCidr
            if ($net) {
                $AllowedIps = $net.Cidr
                Write-Host "    Card mang: $($net.Adapter)  IP may chu: $($net.Ip)  -> dai mang: $AllowedIps"
            } else {
                Write-Warning 'Khong tim thay card mang co IPv4 - de trong ALLOWED_IPS (khong gioi han).'
            }
        }
        $lines = @($lines | Where-Object { $_ -notmatch '^\s*#?\s*ALLOWED_IPS\s*=' }) + "ALLOWED_IPS=$AllowedIps"
        [IO.File]::WriteAllLines($envFile, [string[]]$lines)   # UTF-8 khong BOM
        Write-Host "    Da ghi $envFile : ALLOWED_IPS=$AllowedIps"
    }

    # 3. Kiem tra cong
    foreach ($port in 3000, 4000) {
        $busy = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($busy) {
            $pn = ($busy | ForEach-Object { (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).Path } | Select-Object -First 1)
            Write-Warning "Cong $port dang bi chiem boi: $pn  -> hay tat chuong trinh do (vd ban dev 'npm start') roi chay lai ChayApp.bat."
        }
    }

    # 4. Chay ung dung 1 lan (tac vu tu chay cua ban cu da duoc Stop-App go o buoc 1)
    Write-Step 'Chay ung dung (ChayApp.bat)'
    Start-Process -FilePath (Join-Path $InstallDir 'ChayApp.bat') -WorkingDirectory $InstallDir

    # 5. Tuong lua cho may trong LAN vao cong 3000
    Write-Step 'Mo tuong lua cong 3000'
    Get-NetFirewallRule -DisplayName $FirewallRule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -DisplayName $FirewallRule -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Any | Out-Null

    # 6. Cloudflared tunnel
    if ($NoTunnel) {
        Write-Step 'Bo qua cloudflared (-NoTunnel)'
    } elseif (-not $Token) {
        Write-Warning 'Khong co token tunnel (tunnel-token.txt) - bo qua cai cloudflared.'
    } else {
        Write-Step 'Cai dich vu cloudflared'
        $cf = Join-Path $InstallDir 'bin\cloudflared.exe'
        if (-not (Test-Path $cf)) { throw "Thieu $cf" }
        if (Get-CloudflaredServicePath) {
            Write-Host '    Go dich vu cloudflared cu'
            Invoke-Native $cf @('service', 'uninstall') | Out-Null
            Start-Sleep -Seconds 2
        }
        $rc = Invoke-Native $cf @('service', 'install', $Token)
        if ($rc -ne 0) { throw "cloudflared service install loi (ma $rc)" }
        Start-Service Cloudflared -ErrorAction SilentlyContinue
        Write-Host "    Trang thai: $((Get-Service Cloudflared).Status)"
    }

    # 7. Kiem tra
    Write-Step 'Kiem tra'
    $ok = $false
    for ($i = 0; $i -lt 60 -and -not $ok; $i++) {
        Start-Sleep -Seconds 2
        try { Invoke-WebRequest 'http://127.0.0.1:3000/' -UseBasicParsing -TimeoutSec 5 | Out-Null; $ok = $true } catch {
            if ($_.Exception.Response) { $ok = $true }   # co phan hoi HTTP (vd 307 ve trang dang nhap) la duoc
        }
    }
    if ($ok) { Write-Host '    Giao dien da chay: http://localhost:3000' -ForegroundColor Green }
    else { Write-Warning "Chua thay giao dien phan hoi - xem log trong $InstallDir\logs" }

    Write-Host "`nHOAN TAT. Thu muc: $InstallDir   Log: $InstallDir\logs" -ForegroundColor Green
    Write-Host 'Ung dung KHONG tu chay khi bat may. Chay / chay lai: ChayApp.bat   Dung: DungApp.bat'
    $exit = 0
} catch {
    Write-Host "`nLOI: $($_.Exception.Message)" -ForegroundColor Red
    $exit = 1
} finally {
    Stop-Transcript | Out-Null
}
if (-not $NoPause) { Read-Host 'Nhan Enter de dong' | Out-Null }
exit $exit
