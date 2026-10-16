param([string]$OutputDirectory=(Join-Path $PSScriptRoot 'bin'))
$ErrorActionPreference='Stop'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if(-not (Test-Path -LiteralPath $compiler)){throw 'Windows .NET Framework compiler not found'}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$destination=Join-Path ([IO.Path]::GetFullPath($OutputDirectory)) 'PromWindowBridge.exe'
& $compiler /nologo /target:winexe /optimize+ /platform:anycpu /codepage:65001 /r:System.Windows.Forms.dll /r:System.Drawing.dll ("/out:"+$destination) (Join-Path $PSScriptRoot 'Program.cs')
if($LASTEXITCODE -ne 0){throw 'Build failed'}
Write-Output $destination
