<#
.SYNOPSIS
    Packages the Chrome extension into a clean Chrome Web Store .zip archive.
.DESCRIPTION
    Reads the version from manifest.json, copies only runtime extension files into
    a temporary staging folder (excluding .git, .csv exports, markdown docs, and
    existing .zip files), and creates a root-level .zip ready for Chrome Web Store upload.
#>

$ErrorActionPreference = "Stop"

$RootDir = $PSScriptRoot
$ManifestPath = Join-Path $RootDir "manifest.json"

if (-not (Test-Path $ManifestPath)) {
    throw "manifest.json not found in $RootDir"
}

$Manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$Version = if ($Manifest.version) { $Manifest.version } else { "1.0.0" }
$SafeName = ($Manifest.name -replace '[^a-zA-Z0-9_-]', '-').ToLower() -replace '-+', '-'
$SafeName = $SafeName.Trim('-')

$DistDir = Join-Path $RootDir "dist"
if (-not (Test-Path $DistDir)) {
    New-Item -ItemType Directory -Path $DistDir | Out-Null
}

$ZipName = "$SafeName-v$Version.zip"
$ZipPath = Join-Path $DistDir $ZipName

# Exclude dev/repo/personal files from the store package
$ExcludePatterns = @(
    ".git",
    ".gitignore",
    ".vscode",
    ".idea",
    "dist",
    "build",
    "screenshots",
    "*.csv",
    "*.md",
    "*.ps1",
    "*.zip",
    "*.crx",
    "*.pem",
    ".DS_Store",
    "Thumbs.db"
)

$StagingDir = Join-Path ([System.IO.Path]::GetTempPath()) ("ext-pack-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $StagingDir | Out-Null

try {
    Get-ChildItem -Path $RootDir -Force | Where-Object {
        $itemName = $_.Name
        $excluded = $false
        foreach ($pattern in $ExcludePatterns) {
            if ($itemName -like $pattern) {
                $excluded = $true
                break
            }
        }
        -not $excluded
    } | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination (Join-Path $StagingDir $_.Name) -Recurse -Force
    }

    if (Test-Path $ZipPath) {
        Remove-Item $ZipPath -Force
    }

    Compress-Archive -Path (Join-Path $StagingDir "*") -DestinationPath $ZipPath -CompressionLevel Optimal
    Write-Host "Packed Chrome Web Store archive:" -ForegroundColor Green
    Write-Host "  $ZipPath"
}
finally {
    if (Test-Path $StagingDir) {
        Remove-Item $StagingDir -Recurse -Force
    }
}
