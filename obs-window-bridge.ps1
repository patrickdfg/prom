# Windows 10/11: switch an OBS fullscreen projector / Chrome slideshow.
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File .\obs-window-bridge.ps1
# Keep this file ASCII so Windows PowerShell 5.1 can load it without a BOM.
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class PromWindow {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out Rect rect);
  public delegate bool Callback(IntPtr hWnd, IntPtr data);
  [DllImport("user32.dll")] public static extern bool EnumWindows(Callback cb, IntPtr data);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int cmd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SwitchToThisWindow(IntPtr hWnd, bool altTab);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
}
"@
function Test-Fullscreen([IntPtr]$hwnd) {
  $rect=New-Object PromWindow+Rect
  if(-not [PromWindow]::GetWindowRect($hwnd,[ref]$rect)){return $false}
  $bounds=[System.Windows.Forms.Screen]::FromHandle($hwnd).Bounds
  return ($rect.Left -le $bounds.Left+2 -and $rect.Top -le $bounds.Top+2 -and $rect.Right -ge $bounds.Right-2 -and $rect.Bottom -ge $bounds.Bottom-2)
}
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
    # OBS 32 may title fullscreen windows simply "Projector - Preview".
    # Require both an OBS projector title and fullscreen geometry, never the editor.
    if($kind -eq 'obs' -and $proc -eq 'obs64' -and $title -match '(?i)(projector|\uD504\uB85C\uC81D\uD130)' -and (Test-Fullscreen $hwnd)){
      [void]$script:matches.Add($hwnd)
    }
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
  $hwnd=Find-Window $kind
  if($hwnd -eq [IntPtr]::Zero){
    Write-Host "Window not found: $kind (check OBS projector / Chrome slideshow)"
    return $false
  }
  [void][PromWindow]::ShowWindow($hwnd,4)
  # Raise only the presentation window; keep keyboard focus on the operator.
  $raised=[PromWindow]::SetWindowPos($hwnd,[IntPtr](-1),0,0,0,0,0x0013)
  $released=[PromWindow]::SetWindowPos($hwnd,[IntPtr](-2),0,0,0,0,0x0013)
  if($raised -and $released){Write-Host "Switched: $kind";return $true}
  Write-Host "Could not raise window: $kind"
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
      $body=[System.Text.Encoding]::UTF8.GetBytes((@{ready=$true;obs=((Find-Window 'obs') -ne [IntPtr]::Zero);slideshow=((Find-Window 'slideshow') -ne [IntPtr]::Zero)} | ConvertTo-Json -Compress))
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
