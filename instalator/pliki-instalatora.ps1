# Instalator programu „Edytor PDF” (ten sam schemat, co instalator „Dokumentacja dźwigów”)
# Pobiera: silnik (Electron, oficjalne wydanie z GitHuba) + najnowszą wersję programu z serwera aktualizacji.
# Każdy plik jest sprawdzany sumą SHA-256.
# zatrzymaj się przy każdym błędzie; wyłącz pasek postępu PowerShella (bardzo spowalnia pobieranie)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { $Host.UI.RawUI.WindowTitle = 'Instalacja – Edytor PDF' } catch {}
# adres serwera aktualizacji (release.py może podmienić tę linię) oraz silnik Electron z jego sumą SHA-256
$Serwer      = 'https://aktualizacje.gmarczak.xyz/edytor'
$ElectronUrl = 'https://github.com/electron/electron/releases/download/v33.4.11/electron-v33.4.11-win32-x64.zip'
$ElectronSha = 'F64C8A5A81D9B420B636FDBA13E180F49D69F2198E1D86A8B01F858B17A9483C'
# gdzie instalujemy: %LOCALAPPDATA%\Programs\Edytor PDF (bez uprawnień administratora)
$Progs   = Join-Path $env:LOCALAPPDATA 'Programs'
$Target  = Join-Path $Progs 'Edytor PDF'
$ExeName = 'Edytor PDF.exe'
$Tmp     = Join-Path $Progs 'edytor-pdf-silnik.zip'
# Krok – wypisuje nagłówek kroku; Blad – pokazuje błąd, czeka na Enter i kończy; Sha – liczy sumę SHA-256
function Krok($t){ Write-Host ''; Write-Host "  $t" -ForegroundColor Cyan }
function Blad($t, $gdzie){ Write-Host ''; Write-Host "  BŁĄD: $t" -ForegroundColor Red; if($gdzie){ Write-Host "  ($gdzie)" -ForegroundColor DarkGray }; Write-Host ''; Read-Host '  Naciśnij Enter, aby zamknąć'; exit 1 }
function Sha($bytes){ $h = [Security.Cryptography.SHA256]::Create(); try { -join ($h.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) } finally { $h.Dispose() } }
# tekst jak json.dumps w Pythonie (ensure_ascii) – żeby suma kontrolna się zgadzała
function PyJson([string]$t){
  $sb = New-Object Text.StringBuilder ($t.Length + 1024); [void]$sb.Append('"')
  foreach ($c in $t.ToCharArray()) { $n = [int]$c
    if ($c -eq '\') { [void]$sb.Append('\\') } elseif ($c -eq '"') { [void]$sb.Append('\"') }
    elseif ($n -eq 10) { [void]$sb.Append('\n') } elseif ($n -eq 13) { [void]$sb.Append('\r') } elseif ($n -eq 9) { [void]$sb.Append('\t') }
    elseif ($n -eq 8) { [void]$sb.Append('\b') } elseif ($n -eq 12) { [void]$sb.Append('\f') }
    elseif ($n -lt 32 -or $n -gt 127) { [void]$sb.Append('\u' + $n.ToString('x4')) } else { [void]$sb.Append($c) } }
  [void]$sb.Append('"'); $sb.ToString() }
# klient do pobierania plików z internetu
$Web = New-Object Net.WebClient
$Web.Headers.Add('User-Agent', 'EdytorPDF-Instalator')
# ---- właściwa instalacja w 5 krokach ----
try {
  Write-Host ''
  Write-Host '  ==============================================' -ForegroundColor Yellow
  Write-Host '     Instalacja programu „Edytor PDF”' -ForegroundColor Yellow
  Write-Host '  ==============================================' -ForegroundColor Yellow
  # nie instaluj, gdy program jest uruchomiony (jego pliki byłyby zablokowane)
  if (Get-Process -Name 'Edytor PDF' -ErrorAction SilentlyContinue) { Blad 'Program jest teraz uruchomiony. Zamknij go i uruchom instalator jeszcze raz.' }
  # bezpieczne połączenie TLS 1.2 (potrzebne w starszych Windowsach)
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  New-Item -ItemType Directory -Path $Progs -Force | Out-Null

  # 1) wersja.json z serwera – numer wersji i lista plików do pobrania
  Krok '1/5  Sprawdzam najnowszą wersję programu...'
  $info = (New-Object Text.UTF8Encoding $false).GetString($Web.DownloadData("$Serwer/wersja.json?t=" + [DateTime]::Now.Ticks)) | ConvertFrom-Json
  Write-Host "      wersja $($info.version)"

  # 2) silnik Electron z GitHuba (przez curl z paskiem postępu, jeśli jest); plik pobrany wcześniej
  #    jest używany ponownie, jeśli jego suma kontrolna się zgadza
  Krok '2/5  Pobieram silnik programu (ok. 110 MB, to może potrwać kilka minut)...'
  $ok = $false
  if ([IO.File]::Exists($Tmp)) { if ((Get-FileHash -LiteralPath $Tmp -Algorithm SHA256).Hash -eq $ElectronSha) { $ok = $true; Write-Host '      (plik był już pobrany wcześniej)' } }
  if (-not $ok) {
    $curl = Join-Path $env:SystemRoot 'System32\curl.exe'
    if (Test-Path -LiteralPath $curl) { & $curl -# -L --fail --retry 3 -o $Tmp $ElectronUrl; if ($LASTEXITCODE -ne 0) { Blad 'Nie udało się pobrać plików. Sprawdź połączenie z internetem i spróbuj ponownie.' } }
    else { $Web.DownloadFile($ElectronUrl, $Tmp) }
    if ((Get-FileHash -LiteralPath $Tmp -Algorithm SHA256).Hash -ne $ElectronSha) { [IO.File]::Delete($Tmp); Blad 'Pobrany plik jest uszkodzony. Uruchom instalator jeszcze raz.' }
  }

  # 3) rozpakuj silnik do folderu programu, zmień nazwę electron.exe, usuń zbędne pliki i języki (zostaje polski i angielski)
  Krok '3/5  Rozpakowuję...'
  if (Test-Path -LiteralPath $Target) { Remove-Item -LiteralPath $Target -Recurse -Force }
  New-Item -ItemType Directory -Path $Target -Force | Out-Null
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($Tmp, $Target)
  Rename-Item -LiteralPath (Join-Path $Target 'electron.exe') $ExeName
  Remove-Item -LiteralPath (Join-Path $Target 'resources\default_app.asar') -Force -ErrorAction SilentlyContinue
  Get-ChildItem -LiteralPath (Join-Path $Target 'locales') -File | Where-Object { $_.Name -notin @('pl.pak','en-US.pak') } | Remove-Item -Force

  # 4) pliki programu do resources\app: każdy pobierz, w razie potrzeby rozpakuj, sprawdź sumę SHA-256 i zapisz
  Krok '4/5  Pobieram pliki programu...'
  $App = Join-Path $Target 'resources\app'
  New-Item -ItemType Directory -Path $App -Force | Out-Null
  foreach ($f in $info.files.PSObject.Properties) {
    $p = $f.Name; $m = $f.Value; $z = $null
    # skąd pobrać: z CDN (url) albo z serwera aktualizacji (folder pliki/wersja, ewentualnie plik .gz)
    if ($info.zrodla -and $info.zrodla.PSObject.Properties[$p]) { $z = $info.zrodla.$p }
    if ($z -and $z.url) { $url = $z.url } else { $url = "$Serwer/pliki/$($info.version)/" + (($p -split '/' | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'); if ($z -and $z.gz) { $url += '.gz' } }
    Write-Host "      $p"
    # pobranie (plik może być podzielony na części), rozpakowanie .gz, opakowanie biblioteki, kontrola sumy
    if ($z -and $z.parts) { $ms0 = New-Object IO.MemoryStream; for ($i = 0; $i -lt [int]$z.parts; $i++) { $b = $Web.DownloadData("$url.$i"); $ms0.Write($b, 0, $b.Length) }; $bytes = $ms0.ToArray() }
    else { $bytes = $Web.DownloadData($url) }
    if ($z -and $z.gz) { $in = New-Object IO.MemoryStream (,$bytes); $gz = New-Object IO.Compression.GZipStream($in, [IO.Compression.CompressionMode]::Decompress); $ms = New-Object IO.MemoryStream; $gz.CopyTo($ms); $gz.Dispose(); $bytes = $ms.ToArray() }
    if ($z -and $z.wrap) { $txt = (New-Object Text.UTF8Encoding $false).GetString($bytes); $bytes = (New-Object Text.UTF8Encoding $false).GetBytes($z.wrap + (PyJson $txt) + ";`n") }
    if ((Sha $bytes) -ne $m.sha256) { Blad "Plik $p pobrał się z błędem (zła suma kontrolna). Uruchom instalator jeszcze raz." }
    $out = [IO.Path]::Combine($App, ($p -replace '/', '\'))
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($out))
    [IO.File]::WriteAllBytes($out, $bytes)
  }

  # 5) skróty na Pulpicie i w menu Start (gdy się nie uda – program utworzy je sam)
  Krok '5/5  Tworzę skróty na Pulpicie i w menu Start...'
  $exe = Join-Path $Target $ExeName; $ico = Join-Path $App 'icon.ico'
  try {
    $sh = New-Object -ComObject WScript.Shell
    foreach ($dir in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) {
      try { if ($dir -and [IO.Directory]::Exists($dir)) {
        $l = $sh.CreateShortcut([IO.Path]::Combine($dir, 'Edytor PDF.lnk')); $l.TargetPath = $exe; $l.WorkingDirectory = $Target; $l.IconLocation = "$ico,0"; $l.Description = 'Edytor PDF'; $l.Save() } }
      catch { Write-Host "      (nie udało się utworzyć skrótu w: $dir – program utworzy go sam przy uruchomieniu)" -ForegroundColor DarkYellow }
    }
  } catch { Write-Host '      (skróty utworzy sam program przy pierwszym uruchomieniu)' -ForegroundColor DarkYellow }
  # „Otwórz za pomocą → Edytor PDF” dla plików .pdf (tylko dla tego użytkownika; domyślny program się nie zmienia)
  try {
    $cls = 'HKCU:\Software\Classes'
    New-Item -Path "$cls\EdytorPDF.Dokument\shell\open\command" -Force | Out-Null
    Set-ItemProperty -Path "$cls\EdytorPDF.Dokument" -Name '(default)' -Value 'Dokument PDF – Edytor PDF'
    New-Item -Path "$cls\EdytorPDF.Dokument\DefaultIcon" -Force | Out-Null
    Set-ItemProperty -Path "$cls\EdytorPDF.Dokument\DefaultIcon" -Name '(default)' -Value "$ico,0"
    Set-ItemProperty -Path "$cls\EdytorPDF.Dokument\shell\open\command" -Name '(default)' -Value "`"$exe`" `"%1`""
    New-Item -Path "$cls\.pdf\OpenWithProgids" -Force | Out-Null
    Set-ItemProperty -Path "$cls\.pdf\OpenWithProgids" -Name 'EdytorPDF.Dokument' -Value '' -Type String
    New-Item -Path "$cls\Applications\Edytor PDF.exe\shell\open\command" -Force | Out-Null
    Set-ItemProperty -Path "$cls\Applications\Edytor PDF.exe\shell\open\command" -Name '(default)' -Value "`"$exe`" `"%1`""
    Set-ItemProperty -Path "$cls\Applications\Edytor PDF.exe" -Name 'FriendlyAppName' -Value 'Edytor PDF'
  } catch { Write-Host '      (nie udało się dodać wpisu „Otwórz za pomocą” – można otwierać pliki z programu)' -ForegroundColor DarkYellow }
  # usuń pobrane archiwum silnika
  try { [IO.File]::Delete($Tmp) } catch {}

  # komunikat końcowy i uruchomienie programu
  Write-Host ''
  Write-Host '  GOTOWE! Program jest zainstalowany.' -ForegroundColor Green
  Write-Host '  Skrót „Edytor PDF” jest na Pulpicie i w menu Start.' -ForegroundColor Green
  Write-Host '  Aktualizacje program pobiera sam – przycisk „Aktualizuj” w programie.' -ForegroundColor Green
  Write-Host ''
  try { [Diagnostics.Process]::Start($exe) | Out-Null } catch { Write-Host "  Uruchom program ręcznie: $exe" -ForegroundColor Yellow }
  Start-Sleep -Seconds 4
# każdy nieprzewidziany błąd: pokaż komunikat i miejsce w skrypcie, w którym wystąpił
} catch { Blad $_.Exception.Message $_.InvocationInfo.PositionMessage }
