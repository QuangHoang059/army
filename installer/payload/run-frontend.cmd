@echo off
rem Chay giao dien (cong 3000), tu khoi dong lai neu bi tat. Duoc goi boi tac vu QuanLyVuKhi-Frontend.
cd /d "%~dp0app\frontend"
:loop
echo [%date% %time%] start frontend>> "%~dp0logs\frontend.log"
"%~dp0runtime\node.exe" server.mjs -p 3000 >> "%~dp0logs\frontend.log" 2>&1
ping -n 6 127.0.0.1 >nul
goto loop
