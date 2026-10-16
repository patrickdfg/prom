# Windows 10/11: move only the Chrome slideshow behind / above OBS.
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File .\obs-window-bridge.ps1
# Keep this file ASCII so Windows PowerShell 5.1 can load it without a BOM.
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class PromWindow {
  public delegate bool Callback(IntPtr hWnd, IntPtr data);
  [DllImport("user32.dll")] public static extern bool EnumWindows(Callback cb, IntPtr data);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int cmd);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
}
"@
function Find-Window([string]$kind) {
  $script:matches = [System.Collections.ArrayList]::new()
  $cb = [PromWindow+Callback] {
    param([IntPtr]$hwnd, [IntPtr]$unused)
    if(-not [PromWindow]::IsWindowVisible($hwnd)){return $true}
    $buffer = [System.Text.StringBuilder]::new(512)
    [void][PromWindow]::GetWindowText($hwnd,$buffer,512)
    $title=$buffer.ToString()
    if(-not $title){return $true}
    [uint32]$pidOfWindow=0
    [void][PromWindow]::GetWindowThreadProcessId($hwnd,[ref]$pidOfWindow)
    try{$proc=(Get-Process -Id $pidOfWindow -ErrorAction Stop).ProcessName}catch{return $true}
    if($kind -eq 'slideshow' -and $proc -in @('chrome','msedge') -and $title -match '\uC2AC\uB77C\uC774\uB4DC\uC1FC'){
      [void]$script:matches.Add($hwnd)
    }
    return $true
  }
  [void][PromWindow]::EnumWindows($cb,[IntPtr]::Zero)
  if($script:matches.Count){return $script:matches[0]}
  return [IntPtr]::Zero
}
function Activate([string]$kind){
  # Keep /obs compatible with existing web clients, but never manipulate OBS.
  $hwnd=Find-Window 'slideshow'
  if($hwnd -eq [IntPtr]::Zero){
    Write-Host "Window not found: Chrome slideshow"
    return $false
  }
  # NOMOVE | NOSIZE | NOACTIVATE | NOOWNERZORDER: leave the operator untouched.
  # HWND_BOTTOM also removes any previous TOPMOST status.
  if($kind -eq 'obs'){
    $changed=[PromWindow]::SetWindowPos($hwnd,[IntPtr]1,0,0,0,0,0x0213)
  }elseif($kind -eq 'slideshow'){
    [void][PromWindow]::ShowWindow($hwnd,4)
    $changed=[PromWindow]::SetWindowPos($hwnd,[IntPtr](-1),0,0,0,0,0x0213)
  }else{return $false}
  if($changed){Write-Host "Slideshow order: $kind";return $true}
  Write-Host "Could not reorder slideshow: $kind"
  return $false
}
$listener=[System.Net.HttpListener]::new()
$listener.Prefixes.Add('http://127.0.0.1:17986/')
try{$listener.Start()}catch{Write-Error "Cannot open port 17986: $_";exit 1}
Write-Host "OBS window bridge ready. Keep this window open. Stop: Ctrl+C"
try {
  while($listener.IsListening){
    $ctx=$listener.GetContext()
    $res=$ctx.Response
    $res.Headers.Add('Access-Control-Allow-Origin','https://patrickdfg.github.io')
    $res.Headers.Add('Access-Control-Allow-Methods','GET, POST, OPTIONS')
    $res.Headers.Add('Access-Control-Allow-Headers','Content-Type')
    $res.Headers.Add('Access-Control-Allow-Private-Network','true')
    $res.Headers.Add('Cache-Control','no-store')
    $path=$ctx.Request.Url.AbsolutePath.Trim('/')
    if($ctx.Request.HttpMethod -eq 'OPTIONS'){
      $res.StatusCode=204
    } elseif($ctx.Request.HttpMethod -eq 'GET' -and $path -eq 'health'){
      $res.ContentType='application/json'
      $body=[System.Text.Encoding]::UTF8.GetBytes((@{ready=$true;mode='slideshow-z-order';slideshow=((Find-Window 'slideshow') -ne [IntPtr]::Zero)} | ConvertTo-Json -Compress))
      $res.OutputStream.Write($body,0,$body.Length)
    } elseif($ctx.Request.HttpMethod -eq 'POST' -and $ctx.Request.Headers['Origin'] -eq 'https://patrickdfg.github.io' -and $path -in @('obs','slideshow')){
      try {
        if(Activate $path){$res.StatusCode=204}else{$res.StatusCode=409}
      }catch{Write-Warning $_;$res.StatusCode=500}
    }else{
      $res.StatusCode=403
    }
    $res.Close()
  }
}finally{$listener.Stop();$listener.Close()}
