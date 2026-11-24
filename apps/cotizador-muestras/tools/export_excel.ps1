param(
  [string]$Source = 'C:\Users\group\Downloads\COTIZADOR DE MUESTRAS.xlsx',
  [string]$Out = ''
)

$ErrorActionPreference = 'Stop'

if (-not $Source.EndsWith('.xlsx', [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'Solo se admiten archivos .xlsx sin macros. Convierta el .xlsm original a .xlsx antes de importar.'
}
if (-not (Test-Path $Source -PathType Leaf)) {
  throw "No se encontró el archivo: $Source"
}

if ([string]::IsNullOrWhiteSpace($Out)) {
  $Out = Join-Path (Split-Path $PSScriptRoot -Parent) 'data\catalog.json'
}
$outDir = Split-Path $Out -Parent
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }

function N($x) {
  if ($null -eq $x) { return $null }
  if ($x -is [string] -and [string]::IsNullOrWhiteSpace($x)) { return $null }
  $d = 0.0
  if ([double]::TryParse([string]$x, [ref]$d)) { return $d }
  return $null
}
function S($x) {
  if ($null -eq $x) { return '' }
  return ([string]$x).Trim()
}
function Pct($x) {
  if ($null -eq $x) { return $null }
  $t = ([string]$x).Trim()
  if ($t -eq '') { return $null }
  $hasPct = $t.EndsWith('%')
  if ($hasPct) { $t = $t.Substring(0, $t.Length - 1) }
  $d = 0.0
  if ([double]::TryParse($t, [ref]$d)) {
    if ($hasPct) { return $d / 100.0 }
    return $d
  }
  return $null
}

$excel = $null
$wb = $null
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $excel.AutomationSecurity = 3   # msoAutomationSecurityForceDisable: no ejecutar macros
  $wb = $excel.Workbooks.Open($Source, 0, $true)

  # --- Parametros ---
  $pws = $wb.Worksheets.Item('Parametros')
  $labels = @('supplementPct','costPerMinConf','costPerMinFinish','profitPct','complexityFactor','workDays','hoursPerDay','efficiency')
  $parameters = [ordered]@{}
  for ($r = 2; $r -le 9; $r++) {
    $parameters[$labels[$r - 2]] = N($pws.Cells($r, 2).Value2)
  }

  # --- Base_operaciones ---
  $bws = $wb.Worksheets.Item('Base_operaciones')
  $last = $bws.Cells($bws.Rows.Count, 3).End(-4162).Row
  $v = $bws.Range("A7:X$last").Value2
  $operations = @()
  for ($i = 1; $i -le $v.GetLength(0); $i++) {
    $op = S($v.GetValue($i, 3))
    if ($op -eq '') { continue }
    $operations += [ordered]@{
      id                    = S($v.GetValue($i, 1))
      block                 = S($v.GetValue($i, 2))
      name                  = $op
      family                = S($v.GetValue($i, 4))
      component             = S($v.GetValue($i, 5))
      machine               = S($v.GetValue($i, 6))
      classification        = S($v.GetValue($i, 7))
      referenceCount        = N($v.GetValue($i, 8))
      observationCount      = N($v.GetValue($i, 9))
      minSec                = N($v.GetValue($i, 10))
      p25Sec                = N($v.GetValue($i, 11))
      medianSec             = N($v.GetValue($i, 12))
      p75Sec                = N($v.GetValue($i, 13))
      maxSec                = N($v.GetValue($i, 14))
      cv                    = N($v.GetValue($i, 15))
      reliability           = S($v.GetValue($i, 16))
      validationPriority    = N($v.GetValue($i, 17))
      validatedSec          = N($v.GetValue($i, 18))
      baseSec               = N($v.GetValue($i, 19))
      normalMin             = N($v.GetValue($i, 20))
      samBaseMin            = N($v.GetValue($i, 21))
      historicalSupplement  = N($v.GetValue($i, 22))
      nameVariants          = N($v.GetValue($i, 23))
      exampleOriginalName   = S($v.GetValue($i, 24))
    }
  }

  # --- BD Referencias ---
  $rws = $wb.Worksheets.Item('BD Referencias')
  $lastR = $rws.Cells($rws.Rows.Count, 2).End(-4162).Row
  $vr = $rws.Range("A2:J$lastR").Value2
  $hasMarca = $rws.UsedRange.Columns.Count -ge 11
  $references = @()
  for ($i = 1; $i -le $vr.GetLength(0); $i++) {
    $code = S($vr.GetValue($i, 1))
    if ($code -eq '') { continue }
    $marca = ''
    if ($hasMarca) { $marca = S($rws.Cells($i + 1, 11).Value2) }
    $references += [ordered]@{
      code              = $code
      description       = S($vr.GetValue($i, 2))
      type              = S($vr.GetValue($i, 3))
      confectionMin     = N($vr.GetValue($i, 4))
      finishingMin      = N($vr.GetValue($i, 5))
      packingMin        = N($vr.GetValue($i, 6))
      samTotalMin       = N($vr.GetValue($i, 7))
      supplementPct     = Pct($vr.GetValue($i, 8))
      observation       = S($vr.GetValue($i, 9))
      profitPct         = Pct($vr.GetValue($i, 10))
      marca             = $marca
    }
  }

  # --- Historico (solo metadatos de calidad) ---
  $hws = $wb.Worksheets.Item('Historico')
  $lastH = $hws.Cells($hws.Rows.Count, 2).End(-4162).Row
  $vh = $hws.Range("A2:N$lastH").Value2
  $blankCodes = 0
  $blankSupplement = 0
  $blocks = @{}
  for ($i = 1; $i -le $vh.GetLength(0); $i++) {
    $codeH = $vh.GetValue($i, 2)
    $supH = $vh.GetValue($i, 13)
    if ($null -eq $codeH -or ([string]$codeH).Trim() -eq '') { $blankCodes++ }
    if ($null -eq $supH -or ([string]$supH).Trim() -eq '') { $blankSupplement++ }
    $bk = [string]$vh.GetValue($i, 5)
    if ($blocks.ContainsKey($bk)) { $blocks[$bk]++ } else { $blocks[$bk] = 1 }
  }

  # --- Caso dorado del Cotizador ---
  $cws = $wb.Worksheets.Item('Cotizador')
  $golden = [ordered]@{
    operation       = S($cws.Range("A8").Value2)
    quantity        = 1
    adjustedSec     = N($cws.Range("C8").Value2)
    baseSec         = N($cws.Range("D8").Value2)
    normalMin       = N($cws.Range("E8").Value2)
    samMin          = N($cws.Range("F8").Value2)
    cost            = N($cws.Range("I8").Value2)
    suggestedPrice  = N($cws.Range("B53").Value2)
  }
  $qtyG = N($cws.Range("B8").Value2)
  if ($null -ne $qtyG) { $golden.quantity = $qtyG }

  $catalog = [ordered]@{
    meta = [ordered]@{
      sourceFile       = $Source
      exportedAt       = (Get-Date).ToString('o')
      operationCount   = $operations.Count
      referenceCount   = $references.Count
      historicalRows   = $vh.GetLength(0)
      historicalBlankCodes = $blankCodes
      historicalBlankSupplement = $blankSupplement
      historicalBlocks = $blocks
    }
    parameters   = $parameters
    operations   = $operations
    references   = $references
    goldenCase   = $golden
  }

  $json = $catalog | ConvertTo-Json -Depth 8 -Compress
  [System.IO.File]::WriteAllText($Out, $json, (New-Object System.Text.UTF8Encoding($false)))
  Write-Output "OK: $($operations.Count) operaciones, $($references.Count) referencias, $($vh.GetLength(0)) filas historicas -> $Out"
}
finally {
  if ($null -ne $wb) { $wb.Close($false) }
  if ($null -ne $excel) { $excel.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel) }
}
