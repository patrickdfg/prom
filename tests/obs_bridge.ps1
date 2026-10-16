# Test the production reorder function with fake Win32 calls, without moving windows.
$ErrorActionPreference='Stop'
$path=Join-Path $PSScriptRoot '..\obs-window-bridge.ps1'
$text=[IO.File]::ReadAllText($path)
if($text -match '[^\x00-\x7F]'){throw 'Bridge must remain ASCII for PowerShell 5.1'}
$tokens=$null;$errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$errors)
if($errors.Count){throw ($errors | Out-String)}
$activate=$ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Activate'},$true)
Add-Type @'
using System;
using System.Collections.Generic;
public static class PromWindow {
  public static List<string> Calls=new List<string>();
  public static bool Result=true;
  public static bool ShowWindow(IntPtr h,int cmd){Calls.Add("show:"+h+":"+cmd);return true;}
  public static bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags){
    Calls.Add("order:"+h+":"+after+":"+flags);return Result;
  }
}
'@
$script:found=[IntPtr]123
function Find-Window([string]$kind){
  if($kind -ne 'slideshow'){throw 'Only slideshow may be selected'}
  return $script:found
}
Invoke-Expression $activate.Extent.Text
if(-not (Activate 'obs')){throw 'Start should succeed'}
if(([PromWindow]::Calls -join ',') -ne 'order:123:1:531'){throw 'Start must only lower the slideshow without moving/resizing/activating its owner'}
[PromWindow]::Calls.Clear()
if(-not (Activate 'slideshow')){throw 'End should succeed'}
if(([PromWindow]::Calls -join ',') -ne 'show:123:4,order:123:-1:531'){throw 'End must raise the slideshow without activation or owner reordering'}
[PromWindow]::Calls.Clear()
$script:found=[IntPtr]::Zero
if(Activate 'obs'){throw 'Missing slideshow must fail'}
if([PromWindow]::Calls.Count){throw 'Missing slideshow must not touch any windows'}
$script:found=[IntPtr]123
[PromWindow]::Result=$false
if(Activate 'obs'){throw 'Win32 failure must not report success'}
Write-Output 'PASS start lowers only slideshow, end raises only slideshow, operator flags, missing window, Win32 failure, ASCII, PS parser'
