@echo off
rem Dung he thong (backend + giao dien) cua thu muc nay. Khong anh huong chuong trinh node khac.
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "& { . '%~dp0common.ps1'; Stop-App '%~dp0.' }"
echo Da dung he thong. Chay lai: ChayApp.bat
ping -n 4 127.0.0.1 >nul
