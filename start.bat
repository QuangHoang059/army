@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Quan ly Vu khi - may chu

rem Chạy app ở chế độ production (cổng 3000, backend 4000) cho tên miền quanlyvukhi.dpdns.org.
rem Lần đầu, hoặc sau khi sửa code: start.bat build

if /i "%1"=="build" goto build
if not exist "frontend\.next\BUILD_ID" goto build
goto run

:build
echo === Dang build giao dien (frontend) ...
call npm run build || (echo BUILD LOI & pause & exit /b 1)

:run
echo === Dang chay: http://localhost:3000  (Ctrl+C de dung)
call npm start
pause
