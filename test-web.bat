@echo off
setlocal
chcp 65001 >nul
title maou-website 测试入口
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [X] 没找到 Node.js，请先安装 Node 20 或以上：https://nodejs.org
  pause
  exit /b 1
)

echo 启动 maou-website，就绪后自动打开浏览器
echo 关闭本窗口或按 Ctrl+C 即可停止服务。
echo.

set "OPEN_BROWSER=1"
node server.mjs
echo.
echo 服务已退出（退出码 %errorlevel%）。
pause
