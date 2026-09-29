@echo off
setlocal
chcp 65001 >nul
title maou-website 测试入口
cd /d "%~dp0"

if "%PORT%"=="" set "PORT=5173"
set "URL=http://127.0.0.1:%PORT%"

where node >nul 2>nul
if errorlevel 1 (
  echo [X] 没找到 Node.js，请先安装 Node 20 或以上：https://nodejs.org
  pause
  exit /b 1
)

netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul
if not errorlevel 1 (
  echo 端口 %PORT% 已有服务在运行，直接打开页面：%URL%
  start "" "%URL%"
  exit /b 0
)

echo 启动 maou-website：%URL%
echo 关闭本窗口或按 Ctrl+C 即可停止服务。
echo.

start "" /min powershell -NoProfile -Command "for($i=0;$i -lt 40;$i++){try{Invoke-WebRequest -UseBasicParsing '%URL%' -TimeoutSec 1 | Out-Null;break}catch{Start-Sleep -Milliseconds 250}};Start-Process '%URL%'"

node server.mjs
echo.
echo 服务已退出（退出码 %errorlevel%）。
pause
