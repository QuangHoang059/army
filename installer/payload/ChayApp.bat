@echo off
rem Chay (hoac CHAY LAI) he thong: dung ban dang chay cua thu muc nay, roi mo backend + giao dien
rem trong 2 cua so thu nho. Khong tu chay khi bat may, khong tu khoi dong lai khi bi tat.
rem Sua app\backend\.env (vd ALLOWED_IPS) xong -> chay lai file nay de ap dung.
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
cd /d "%~dp0"
echo Dung ban dang chay (neu co)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "& { . '%~dp0common.ps1'; Stop-App '%~dp0.' }"
ping -n 3 127.0.0.1 >nul
echo Khoi dong backend va giao dien...
start "QLVK Backend" /min cmd /c ""%~dp0run-backend.cmd""
start "QLVK Giao dien" /min cmd /c ""%~dp0run-frontend.cmd""
echo.
echo Da chay. Mo http://localhost:3000  (2 cua so dang thu nho tren thanh tac vu)
echo Dung: DungApp.bat (hoac dong 2 cua so do).  Chay lai: chay lai file nay.
ping -n 6 127.0.0.1 >nul
