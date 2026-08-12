@echo off
title 修复摄像头
cd /d "%~dp0"

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo 需要管理员权限，正在弹出授权窗口，请点"是"……
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo 正在重启摄像头设备（禁用 2 秒后重新启用）...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\camera-cycle.ps1"

echo.
echo 完成。请打开 Windows 自带"相机"应用测试画面是否恢复，
echo 恢复后再启动游戏。
pause
