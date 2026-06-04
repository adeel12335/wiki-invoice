$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = if ($env:PORT) { [int]$env:PORT } else { 3000 }
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Invoice portal running at http://localhost:$port/"

$types = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".png" = "image/png"
  ".pdf" = "application/pdf"
}

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $requestPath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart("/"))
  if ([string]::IsNullOrWhiteSpace($requestPath)) {
    $requestPath = "index.html"
  }

  $filePath = [System.IO.Path]::GetFullPath((Join-Path $root $requestPath))
  if (-not $filePath.StartsWith($root)) {
    $context.Response.StatusCode = 403
    $context.Response.Close()
    continue
  }

  if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
    $context.Response.StatusCode = 404
    $context.Response.Close()
    continue
  }

  $extension = [System.IO.Path]::GetExtension($filePath)
  $context.Response.ContentType = if ($types.ContainsKey($extension)) { $types[$extension] } else { "application/octet-stream" }
  $bytes = [System.IO.File]::ReadAllBytes($filePath)
  $context.Response.ContentLength64 = $bytes.Length
  $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $context.Response.Close()
}
