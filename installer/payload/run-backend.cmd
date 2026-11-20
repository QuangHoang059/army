@echo off
rem Chay backend (cong 4000) 1 lan - KHONG tu khoi dong lai. Duoc mo boi ChayApp.bat.
rem Dong cua so nay (hoac chay DungApp.bat) = dung backend.
title QLVK Backend (cong 4000) - dong cua so nay de dung
if not exist "%~dp0logs" mkdir "%~dp0logs"
cd /d "%~dp0app\backend"
echo Backend dang chay (cong 4000). Log: %~dp0logs\backend.log
echo Dong cua so nay hoac chay DungApp.bat de dung.
echo [%date% %time%] start backend>> "%~dp0logs\backend.log"
"%~dp0runtime\node.exe" src\server.js >> "%~dp0logs\backend.log" 2>&1
echo [%date% %time%] backend da dung (ma %errorlevel%)>> "%~dp0logs\backend.log"
echo.
echo Backend DA DUNG (ma %errorlevel%). Xem log: %~dp0logs\backend.log
echo Chay lai: ChayApp.bat
pause
