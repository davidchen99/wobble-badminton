@echo off
title Wobble Badminton
cd /d "%~dp0"

echo ==========================================
echo   Wobble Badminton 体感羽毛球
echo.
echo   浏览器会自动打开游戏页面。
echo   关闭本窗口 = 退出游戏
echo ==========================================
echo.

rem 游戏已在运行（端口已响应）时：直接打开浏览器，不再重复启动避免端口报错
curl -s -o nul --max-time 2 http://localhost:5173/
if not errorlevel 1 (
  echo 检测到游戏已在运行，直接打开浏览器……
  echo 本窗口 5 秒后自动关闭。
  start http://localhost:5173
  timeout /t 5 ^>nul
  exit /b 0
)

rem vite --open：服务器就绪后自动打开浏览器（比定时跳转可靠）
call npm run dev -- --strictPort --open

echo.
echo 游戏已停止，按任意键关闭本窗口...
pause ^>nul
