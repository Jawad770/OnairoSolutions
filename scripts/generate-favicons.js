/**
 * Generate Onairo favicon assets from the hexagonal brand mark using System.Drawing.
 * Source of truth for the mark geometry matches public/favicon.svg (blue hex + O).
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const PS1 = path.join(ROOT, "scripts", "_gen-favicons.ps1");

const ps = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function New-HexPoints([int]$cx, [int]$cy, [float]$r) {
  $pts = @()
  for ($i = 0; $i -lt 6; $i++) {
    $ang = [Math]::PI / 180 * (-90 + $i * 60)
    $pts += New-Object Drawing.PointF (($cx + $r * [Math]::Cos($ang)), ($cy + $r * [Math]::Sin($ang)))
  }
  return ,$pts
}

function Write-IconPng([string]$outPath, [int]$size) {
  $bmp = New-Object Drawing.Bitmap $size, $size
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([Drawing.Color]::FromArgb(255, 10, 15, 30))

  $cx = $size / 2
  $cy = $size / 2
  $outer = $size * 0.42
  $inner = $size * 0.30

  $brushOuter = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(255, 10, 15, 30))
  $penOuter = New-Object Drawing.Pen ([Drawing.Color]::FromArgb(255, 59, 130, 246), [Math]::Max(1.5, $size * 0.034))
  $brushInner = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(38, 37, 99, 235))
  $penInner = New-Object Drawing.Pen ([Drawing.Color]::FromArgb(102, 59, 130, 246), [Math]::Max(1.0, $size * 0.018))

  $g.FillPolygon($brushOuter, (New-HexPoints $cx $cy $outer))
  $g.DrawPolygon($penOuter, (New-HexPoints $cx $cy $outer))
  $g.FillPolygon($brushInner, (New-HexPoints $cx $cy $inner))
  $g.DrawPolygon($penInner, (New-HexPoints $cx $cy $inner))

  $fontSize = [Math]::Max(10, [int]($size * 0.36))
  $font = New-Object Drawing.Font 'Segoe UI', $fontSize, ([Drawing.FontStyle]::Bold)
  $sf = New-Object Drawing.StringFormat
  $sf.Alignment = [Drawing.StringAlignment]::Center
  $sf.LineAlignment = [Drawing.StringAlignment]::Center
  $brushText = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(255, 59, 130, 246))
  $rect = New-Object Drawing.RectangleF 0, 0, $size, $size
  $g.DrawString('O', $font, $brushText, $rect, $sf)

  $bmp.Save($outPath, [Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $font.Dispose(); $penOuter.Dispose(); $penInner.Dispose(); $brushOuter.Dispose(); $brushInner.Dispose(); $brushText.Dispose()
}

$public = '${PUBLIC.replace(/\\/g, "\\\\")}'
Write-IconPng (Join-Path $public 'favicon.png') 48
Write-IconPng (Join-Path $public 'apple-touch-icon.png') 180
Write-IconPng (Join-Path $public 'og-icon.png') 512
Write-IconPng (Join-Path $public '_favicon-16.png') 16
Write-IconPng (Join-Path $public '_favicon-32.png') 32
Write-Output 'PNG_OK'
`;

fs.writeFileSync(PS1, ps);
const r = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", PS1], {
  encoding: "utf8",
});
fs.unlinkSync(PS1);
if (r.status !== 0) {
  console.error(r.stdout || "");
  console.error(r.stderr || "");
  process.exit(r.status || 1);
}
console.log((r.stdout || "").trim());

function pngToIco(entries) {
  const count = entries.length;
  const headerSize = 6 + count * 16;
  const offsets = [];
  let offset = headerSize;
  for (const e of entries) {
    offsets.push(offset);
    offset += e.buffer.length;
  }
  const out = Buffer.alloc(offset);
  out.writeUInt16LE(0, 0);
  out.writeUInt16LE(1, 2);
  out.writeUInt16LE(count, 4);
  for (let i = 0; i < count; i++) {
    const entry = 6 + i * 16;
    const dim = entries[i].size >= 256 ? 0 : entries[i].size;
    out.writeUInt8(dim, entry);
    out.writeUInt8(dim, entry + 1);
    out.writeUInt8(0, entry + 2);
    out.writeUInt8(0, entry + 3);
    out.writeUInt16LE(1, entry + 4);
    out.writeUInt16LE(32, entry + 6);
    out.writeUInt32LE(entries[i].buffer.length, entry + 8);
    out.writeUInt32LE(offsets[i], entry + 12);
  }
  for (let i = 0; i < count; i++) entries[i].buffer.copy(out, offsets[i]);
  return out;
}

const png16 = fs.readFileSync(path.join(PUBLIC, "_favicon-16.png"));
const png32 = fs.readFileSync(path.join(PUBLIC, "_favicon-32.png"));
const png48 = fs.readFileSync(path.join(PUBLIC, "favicon.png"));
const ico = pngToIco([
  { size: 16, buffer: png16 },
  { size: 32, buffer: png32 },
  { size: 48, buffer: png48 },
]);
fs.writeFileSync(path.join(PUBLIC, "favicon.ico"), ico);
fs.unlinkSync(path.join(PUBLIC, "_favicon-16.png"));
fs.unlinkSync(path.join(PUBLIC, "_favicon-32.png"));

if (fs.existsSync(path.join(ROOT, "favicon.svg"))) {
  fs.copyFileSync(path.join(PUBLIC, "favicon.png"), path.join(ROOT, "favicon.png"));
  fs.copyFileSync(path.join(PUBLIC, "favicon.ico"), path.join(ROOT, "favicon.ico"));
}

console.log("Wrote public/favicon.png, apple-touch-icon.png, favicon.ico, og-icon.png");
