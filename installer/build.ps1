# Dong goi he thong thanh bo cai dat (chay tren MAY DEV, khong can quyen admin).
#   powershell -ExecutionPolicy Bypass -File installer\build.ps1 [-SkipBuild] [-IncludeData] [-NoZip]
# Ket qua:
#   dist\QuanLyVuKhi\            thu muc cai dat (dat vao noi co dinh tren may chu, chay CaiDat.bat tai cho)
#   dist\QuanLyVuKhi.zip         ban nen cua thu muc tren
#   dist\QuanLyVuKhi-Setup.exe   neu may co Inno Setup 6 (ISCC.exe)
param(
    [switch]$SkipBuild,     # khong chay "next build" (dung .next da build san)
    [switch]$IncludeData,   # kem du lieu hien tai (backend\data) lam du lieu ban dau - NEN tat backend truoc
    [switch]$NoZip,
    [string]$Cloudflared = ''
)
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Dist = Join-Path $Root 'dist'
$Pkg = Join-Path $Dist 'QuanLyVuKhi'

function Step($m) { Write-Host "`n=== $m" -ForegroundColor Cyan }
function Robo([string]$From, [string]$To, [string[]]$Extra = @()) {
    robocopy $From $To /MIR /XJ /R:1 /W:1 /NFL /NDL /NJH /NJS /NP @Extra | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy loi ($LASTEXITCODE): $From" }
}

# 1. Build giao dien
if (-not $SkipBuild) {
    Step 'Build giao dien (next build)'
    Push-Location (Join-Path $Root 'frontend')
    try { npm run build; if ($LASTEXITCODE) { throw 'next build loi' } } finally { Pop-Location }
}
if (-not (Test-Path (Join-Path $Root 'frontend\.next\BUILD_ID'))) { throw 'Chua co frontend\.next - bo -SkipBuild' }

# 2. Thu muc goi
Step "Tao goi tai $Pkg"
if (Test-Path $Pkg) { Remove-Item $Pkg -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Pkg | Out-Null

# Backend: src + node_modules (better-sqlite3 da build cho dung node.exe di kem), KHONG kem data/backups/.env
$be = Join-Path $Root 'backend'
Robo $be (Join-Path $Pkg 'app\backend') @('/XD', "$be\data", "$be\backups", '/XF', '.env')
if ($IncludeData -and (Test-Path "$be\data")) {
    Write-Host '    Kem du lieu ban dau backend\data'
    Robo "$be\data" (Join-Path $Pkg 'app\backend\data') @('/XF', '*-wal', '*-shm')
}

# Frontend: .next (bo cache), node_modules (bo junction army-qr-weapons -> thu muc goc), cau hinh
$fe = Join-Path $Root 'frontend'
Robo $fe (Join-Path $Pkg 'app\frontend') @('/XD', "$fe\src", "$fe\.next\cache", '/XF', 'tsconfig.tsbuildinfo')

# 3. Node.js di kem (cung phien ban da cai node_modules -> khop module native)
Step 'Chep node.exe'
$node = (Get-Command node).Source
New-Item -ItemType Directory -Force -Path (Join-Path $Pkg 'runtime') | Out-Null
Copy-Item $node (Join-Path $Pkg 'runtime\node.exe')
Write-Host "    $node ($(& $node -v))"

# 4. cloudflared.exe
Step 'Chep cloudflared.exe'
if (-not $Cloudflared) {
    $c = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($c) { $Cloudflared = $c.Source }
    elseif (Test-Path "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe") { $Cloudflared = "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe" }
}
New-Item -ItemType Directory -Force -Path (Join-Path $Pkg 'bin') | Out-Null
$cfDst = Join-Path $Pkg 'bin\cloudflared.exe'
if ($Cloudflared -and (Test-Path $Cloudflared)) {
    Copy-Item $Cloudflared $cfDst
    Write-Host "    tu $Cloudflared"
} else {
    Write-Host '    Tai ban moi nhat tu GitHub...'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile $cfDst -UseBasicParsing
}

# 5. Script cai dat + token
Step 'Chep script cai dat'
Get-ChildItem (Join-Path $PSScriptRoot 'payload') -File | ForEach-Object {
    $dst = Join-Path $Pkg $_.Name
    if ($_.Extension -in '.cmd', '.bat', '.txt', '.ps1') {
        # chuan hoa CRLF cho cmd/bat/powershell
        $text = [IO.File]::ReadAllText($_.FullName) -replace "`r?`n", "`r`n"
        [IO.File]::WriteAllText($dst, $text)
    } else { Copy-Item $_.FullName $dst }
}
$tok = Join-Path $PSScriptRoot 'tunnel-token.txt'
if (Test-Path $tok) { Copy-Item $tok (Join-Path $Pkg 'tunnel-token.txt'); Write-Host '    Kem tunnel-token.txt' }
else { Write-Warning 'Khong co installer\tunnel-token.txt -> may chu se khong cai cloudflared' }

# 6. Nen zip
if (-not $NoZip) {
    Step 'Nen zip'
    $zip = Join-Path $Dist 'QuanLyVuKhi.zip'
    if (Test-Path $zip) { Remove-Item $zip -Force }
    & "$env:SystemRoot\System32\tar.exe" -a -c -f $zip -C $Dist QuanLyVuKhi
    if ($LASTEXITCODE) { throw 'Nen zip loi' }
    Write-Host "    $zip ($([math]::Round((Get-Item $zip).Length / 1MB)) MB)"
}

# 7. Setup.exe (neu co Inno Setup 6)
$iscc = @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe", "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe") |
    Where-Object { Test-Path $_ } | Select-Object -First 1
if ($iscc) {
    Step 'Tao QuanLyVuKhi-Setup.exe (Inno Setup)'
    & $iscc /Q (Join-Path $PSScriptRoot 'QuanLyVuKhi.iss')
    if ($LASTEXITCODE) { throw 'ISCC loi' }
    Write-Host "    $(Join-Path $Dist 'QuanLyVuKhi-Setup.exe')"
} else {
    Write-Host "`n(Khong thay Inno Setup 6 -> bo qua Setup.exe. Cai tu https://jrsoftware.org/isdl.php neu muon 1 file .exe)"
}

Write-Host "`nXONG. Giai nen QuanLyVuKhi.zip vao noi dat co dinh tren may chu (vd D:\QuanLyVuKhi) roi chay CaiDat.bat tai do" -ForegroundColor Green
