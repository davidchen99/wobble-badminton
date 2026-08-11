@echo off
title Wobble Badminton
cd /d "%~dp0"

echo ==========================================
echo   Wobble Badminton 体感羽毛球
echo.
echo   浏览器会自动打开游戏页面。
echo   关闭本窗口 = 退出游戏
echo   若提示端口被占用，说明游戏已在运行，
echo   直接使用已打开的浏览器窗口即可。
echo ==========================================
echo.

rem 延迟 2 秒等服务器就绪后再打开浏览器（最小化窗口一闪而过）
start "" /min cmd /c "timeout /t 2 >nul && start http://localhost:5173"

call npm run dev -- --strictPort

echo.
echo 游戏已停止，按任意键关闭本窗口...
pause >nul
