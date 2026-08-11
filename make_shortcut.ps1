$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# --- draw a simple icon: green court + white shuttle cone + red cork ---
Add-Type -AssemblyName System.Drawing
$size = 64
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::FromArgb(78, 143, 82))
$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$red = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(229, 57, 53))
$pts = [System.Drawing.Point[]]@(
  (New-Object System.Drawing.Point 32, 8),
  (New-Object System.Drawing.Point 14, 42),
  (New-Object System.Drawing.Point 50, 42)
)
$g.FillPolygon($white, $pts)
$g.FillEllipse($red, 24, 38, 16, 16)
$hicon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hicon)
$icoPath = Join-Path $root 'icon.ico'
$fs = New-Object System.IO.FileStream($icoPath, [System.IO.FileMode]::Create)
$icon.Save($fs)
$fs.Close()
$g.Dispose(); $bmp.Dispose()

# --- desktop shortcut to the launcher .bat (found by wildcard to avoid encoding issues) ---
$bat = Get-ChildItem $root -Filter '*.bat' | Select-Object -First 1
if (-not $bat) { throw 'no .bat launcher found' }
$ws = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop 'Wobble Badminton.lnk'
$sc = $ws.CreateShortcut($lnkPath)
$sc.TargetPath = $bat.FullName
$sc.WorkingDirectory = $root
$sc.IconLocation = $icoPath
$sc.Description = 'Wobble Badminton'
$sc.Save()
Write-Output "OK bat=$($bat.FullName)"
Write-Output "OK icon=$icoPath"
Write-Output "OK shortcut=$lnkPath"
