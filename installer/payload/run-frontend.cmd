@echo off
rem Chay giao dien (cong 3000) 1 lan - KHONG tu khoi dong lai. Duoc mo boi ChayApp.bat.
rem Dong cua so nay (hoac chay DungApp.bat) = dung giao dien.
title QLVK Giao dien (cong 3000) - dong cua so nay de dung
if not exist "%~dp0logs" mkdir "%~dp0logs"
cd /d "%~dp0app\frontend"
echo Giao dien dang chay: http://localhost:3000   Log: %~dp0logs\frontend.log
echo Dong cua so nay hoac chay DungApp.bat de dung.
echo [%date% %time%] start frontend>> "%~dp0logs\frontend.log"
"%~dp0runtime\node.exe" server.mjs -p 3000 >> "%~dp0logs\frontend.log" 2>&1
echo [%date% %time%] frontend da dung (ma %errorlevel%)>> "%~dp0logs\frontend.log"
echo.
echo Giao dien DA DUNG (ma %errorlevel%). Xem log: %~dp0logs\frontend.log
echo Chay lai: ChayApp.bat
pause
