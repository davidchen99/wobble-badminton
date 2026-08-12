$out = @()
$out += "=== Camera devices ==="
Get-PnpDevice -Class Camera -ErrorAction SilentlyContinue | ForEach-Object { $out += ($_.FriendlyName + ' | ' + $_.Status + ' | ' + $_.InstanceId) }
$out += "=== Driver ==="
$cam = Get-PnpDevice -Class Camera -ErrorAction SilentlyContinue | Where-Object FriendlyName -eq 'Integrated Camera'
if ($cam) {
  $ver = Get-PnpDeviceProperty -InstanceId $cam.InstanceId -KeyName 'DEVPKEY_Device_DriverVersion' -ErrorAction SilentlyContinue
  $date = Get-PnpDeviceProperty -InstanceId $cam.InstanceId -KeyName 'DEVPKEY_Device_DriverDate' -ErrorAction SilentlyContinue
  $out += ('DriverVersion: ' + $ver.Data)
  $out += ('DriverDate: ' + $date.Data)
}
$out += "=== Privacy (HKLM DeviceAccess) ==="
$k = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\DeviceAccess\Global\{E5323777-F976-4f5b-9B55-B94699C46E44}'
$p = Get-ItemProperty $k -ErrorAction SilentlyContinue
$out += ('Value: ' + $(if ($p) { $p.Value } else { '(key missing = default Allow)' }))
$out += "=== FrameServer service ==="
$svc = Get-Service FrameServer -ErrorAction SilentlyContinue
$out += ('FrameServer: ' + $(if ($svc) { $svc.Status } else { 'not found' }))
$out += "=== Lenovo Vantage ==="
$v = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match 'Vantage' }
$out += $(if ($v) { ($v | ForEach-Object { $_.DisplayName + ' ' + $_.DisplayVersion }) -join '; ' } else { '(not installed)' })
$out += "=== Attempt: cycle camera device (disable/enable) ==="
try {
  Disable-PnpDevice -InstanceId 'USB\VID_174F&PID_2454&MI_00\6&35230690&0&0000' -Confirm:$false -ErrorAction Stop
  Start-Sleep -Seconds 2
  Enable-PnpDevice -InstanceId 'USB\VID_174F&PID_2454&MI_00\6&35230690&0&0000' -Confirm:$false -ErrorAction Stop
  $out += 'device cycled OK'
} catch {
  $out += ('cycle failed: ' + $_.Exception.Message)
}
$out += "=== Attempt: restart FrameServer ==="
try {
  Restart-Service FrameServer -Force -ErrorAction Stop
  $out += 'FrameServer restarted OK'
} catch {
  $out += ('restart failed: ' + $_.Exception.Message)
}
$out | Out-File -FilePath (Join-Path $PWD 'camera-diag.txt') -Encoding utf8
