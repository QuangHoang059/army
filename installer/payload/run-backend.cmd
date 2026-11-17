@echo off
rem Chay backend (cong 4000), tu khoi dong lai neu bi tat. Duoc goi boi tac vu QuanLyVuKhi-Backend.
cd /d "%~dp0app\backend"
:loop
echo [%date% %time%] start backend>> "%~dp0logs\backend.log"
"%~dp0runtime\node.exe" src\server.js >> "%~dp0logs\backend.log" 2>&1
ping -n 6 127.0.0.1 >nul
goto loop
