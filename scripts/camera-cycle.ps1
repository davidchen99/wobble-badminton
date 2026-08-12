# Power-cycle all camera devices + restart Windows Camera Frame Server.
# Run elevated (the companion bat self-elevates via UAC).
$ids = @(Get-PnpDevice -Class Camera -ErrorAction SilentlyContinue | Select-Object -ExpandProperty InstanceId)
if ($ids.Count -eq 0) {
  Write-Output 'no camera device found'
  exit 1
}
foreach ($id in $ids) {
  Write-Output ("disable: " + $id)
  Disable-PnpDevice -InstanceId $id -Confirm:$false -ErrorAction Continue
}
Start-Sleep -Seconds 2
foreach ($id in $ids) {
  Write-Output ("enable: " + $id)
  Enable-PnpDevice -InstanceId $id -Confirm:$false -ErrorAction Continue
}
Restart-Service FrameServer -Force -ErrorAction SilentlyContinue
Write-Output 'done: camera cycled + FrameServer restarted'
