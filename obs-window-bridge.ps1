# Windows 10/11: 말씀 원고의 (영상)/(영상끝) 제어 표식을 받아 창을 전환합니다.
# PowerShell에서 실행: powershell -NoProfile -ExecutionPolicy Bypass -File .\obs-window-bridge.ps1
# OBS에서 '전체 화면 프로젝터(프로그램)'를 먼저 열고, Chrome에서 '슬라이드쇼' 창을 여세요.
Add-Type -AssemblyName System.Windows.Forms
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
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SwitchToThisWindow(IntPtr hWnd, bool altTab);
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
    if($kind -eq 'obs' -and $proc -eq 'obs64' -and $title -match '(?i)(fullscreen projector|full.screen projector|projector.*program|전체.?화면.?프로젝터|전체.?화면.*프로젝터|프로젝터.*프로그램)'){
      [void]$script:matches.Add($hwnd)
    }
    if($kind -eq 'slideshow' -and $proc -in @('chrome','msedge') -and $title -match '슬라이드쇼'){
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
    Write-Host "창을 찾지 못함: $kind (OBS 전체 화면 프로젝터 / Chrome 슬라이드쇼 확인)"
    return
  }
  [void][PromWindow]::ShowWindow($hwnd,9)
  # Windows 전면 표시 제한을 우회하도록 TOPMOST를 잠시 설정하고 즉시 해제
  [void][PromWindow]::SetWindowPos($hwnd,[IntPtr](-1),0,0,0,0,0x0003)
  [void][PromWindow]::SetWindowPos($hwnd,[IntPtr](-2),0,0,0,0,0x0003)
  [void][PromWindow]::SetForegroundWindow($hwnd)
  Write-Host "전환: $kind"
}
$listener=[System.Net.HttpListener]::new()
$listener.Prefixes.Add('http://127.0.0.1:17986/')
try{$listener.Start()}catch{Write-Error "포트 17986을 열 수 없습니다: $_";exit 1}
Write-Host "OBS/슬라이드쇼 전환 준비 완료. 이 창은 닫지 마세요. (종료: Ctrl+C)"
try {
  while($listener.IsListening){
    $ctx=$listener.GetContext()
    $res=$ctx.Response
    $res.Headers.Add('Access-Control-Allow-Origin','https://patrickdfg.github.io')
    $res.Headers.Add('Access-Control-Allow-Methods','POST, OPTIONS')
    $res.Headers.Add('Access-Control-Allow-Headers','Content-Type')
    $res.Headers.Add('Access-Control-Allow-Private-Network','true')
    $res.Headers.Add('Cache-Control','no-store')
    $path=$ctx.Request.Url.AbsolutePath.Trim('/')
    if($ctx.Request.HttpMethod -eq 'OPTIONS'){
      $res.StatusCode=204
    } elseif($ctx.Request.HttpMethod -eq 'POST' -and $ctx.Request.Headers['Origin'] -eq 'https://patrickdfg.github.io' -and $path -in @('obs','slideshow')){
      Activate $path
      $res.StatusCode=204
    }else{
      $res.StatusCode=403
    }
    $res.Close()
  }
}finally{$listener.Stop();$listener.Close()}
