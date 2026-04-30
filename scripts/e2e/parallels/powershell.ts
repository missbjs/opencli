export function psSingleQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function psArray(values: string[]): string {
  return `@(${values.map(psSingleQuote).join(", ")})`;
}

export function encodePowerShell(script: string): string {
  return Buffer.from(`$ProgressPreference = 'SilentlyContinue'\n${script}`, "utf16le").toString(
    "base64",
  );
}

export const windowsOpenCLIResolver = String.raw`function Resolve-OpenCLICommand {
  if ($script:OpenCLIResolvedCommand) { return $script:OpenCLIResolvedCommand }
  $shimCandidates = @()
  if ($env:APPDATA) {
    $shimCandidates += Join-Path $env:APPDATA 'npm\opencli.cmd'
    $shimCandidates += Join-Path $env:APPDATA 'npm\opencli.ps1'
  }
  foreach ($name in @('opencli.cmd', 'opencli.ps1', 'opencli')) {
    $command = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command -and $command.Source) { $shimCandidates += $command.Source }
  }
  $npmPrefix = $null
  try {
    $npmPrefix = (& npm.cmd prefix -g 2>$null | Select-Object -First 1)
  } catch {}
  if ($npmPrefix) {
    $shimCandidates += Join-Path $npmPrefix 'opencli.cmd'
    $shimCandidates += Join-Path $npmPrefix 'opencli.ps1'
  }
  foreach ($candidate in $shimCandidates) {
    if ($candidate -and (Test-Path $candidate)) {
      $script:OpenCLIResolvedCommand = @{ Kind = 'shim'; Path = $candidate }
      return $script:OpenCLIResolvedCommand
    }
  }
  $entryCandidates = @()
  if ($env:APPDATA) {
    $entryCandidates += Join-Path $env:APPDATA 'npm\node_modules\opencli\opencli.mjs'
  }
  if ($npmPrefix) {
    $entryCandidates += Join-Path $npmPrefix 'node_modules\opencli\opencli.mjs'
  }
  foreach ($candidate in $entryCandidates) {
    if ($candidate -and (Test-Path $candidate)) {
      $script:OpenCLIResolvedCommand = @{ Kind = 'node'; Path = $candidate }
      return $script:OpenCLIResolvedCommand
    }
  }
  throw 'opencli command not found in PATH, APPDATA npm, or npm global prefix'
}
function Invoke-OpenCLI {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]] $OpenCLIArgs)
  $command = Resolve-OpenCLICommand
  if ($command.Kind -eq 'node') {
    & node.exe $command.Path @OpenCLIArgs
  } else {
    & $command.Path @OpenCLIArgs
  }
}`;
