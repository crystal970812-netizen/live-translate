$ErrorActionPreference = 'Stop'
try {
  $app = 'C:\Users\cryst\Downloads\live-translate-offline-v4\live-translate\app'
  if (!(Test-Path -LiteralPath (Join-Path $app 'vendor'))) { throw 'Original app folder not found.' }
  $files = @('opencc-cn2t.js','transformers.js','ort-wasm-simd-threaded.asyncify.mjs','ort-wasm-simd-threaded.asyncify.wasm','sherpa/sherpa-onnx-asr.js','sherpa/sherpa-onnx-wasm-main-vad-asr.js','sherpa/sherpa-onnx-wasm-main-vad-asr.wasm')
  foreach ($name in $files) {
    $source = Join-Path (Join-Path $app 'vendor') $name
    if (!(Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing asset: $name" }
  }
  $model = Join-Path $app 'vendor\sherpa\sherpa-onnx-wasm-main-vad-asr.data'
  if (!(Test-Path -LiteralPath $model -PathType Leaf)) { throw 'Model file not found.' }
  $parts = Join-Path $PSScriptRoot 'model-parts'
  if (Test-Path -LiteralPath $parts) { throw 'model-parts already exists. Extract a fresh copy of this package first.' }
  foreach ($name in $files) {
    $dest = Join-Path (Join-Path $PSScriptRoot 'public\vendor') $name
    New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
    Copy-Item -LiteralPath (Join-Path (Join-Path $app 'vendor') $name) -Destination $dest
  }
  New-Item -ItemType Directory -Path $parts | Out-Null
  $inputStream = [IO.File]::OpenRead($model)
  try {
    $buffer = New-Object byte[] (20 * 1024 * 1024)
    $i = 0
    while ($true) {
      $offset = 0
      while ($offset -lt $buffer.Length) {
        $read = $inputStream.Read($buffer,$offset,$buffer.Length-$offset)
        if ($read -eq 0) { break }
        $offset += $read
      }
      if ($offset -eq 0) { break }
      $out = [IO.File]::Create((Join-Path $parts ('sense-{0:D3}.part' -f $i)))
      try { $out.Write($buffer,0,$offset) } finally { $out.Dispose() }
      $i++
    }
    [IO.File]::WriteAllText((Join-Path $parts 'manifest.json'),('{"bytes":'+$inputStream.Length+',"parts":'+$i+'}'))
  } finally { $inputStream.Dispose() }
  Write-Host 'Completed. Original app unchanged. Deployment files are ready in this folder.' -ForegroundColor Green
} catch { Write-Host ('Stopped: '+$_.Exception.Message) -ForegroundColor Red; exit 1 }
