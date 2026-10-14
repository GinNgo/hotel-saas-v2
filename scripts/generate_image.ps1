param (
    [Parameter(Mandatory = $true)]
    [string]$Prompt,

    [Parameter(Mandatory = $false)]
    [string]$OutputFile = "output.png",

    [Parameter(Mandatory = $false)]
    [string]$Model = "ag/gemini-3.1-flash-image",

    [Parameter(Mandatory = $false)]
    [string]$Size = "auto",

    [Parameter(Mandatory = $false)]
    [string]$Quality = "auto",

    [Parameter(Mandatory = $false)]
    [string]$ImageDetail = "high",

    [Parameter(Mandatory = $false)]
    [string]$Format = "png"
)

$ErrorActionPreference = "Stop"

$apiUrl = "http://localhost:20128/v1/images/generations"
$apiKey = "sk-b3a81036624ac7f5-l0yjhu-6d5d0d22"

Write-Host "[Local Image AI] Đang gửi yêu cầu sinh ảnh..." -ForegroundColor Cyan
Write-Host "  Model: $Model" -ForegroundColor DarkGray
Write-Host "  Prompt: $Prompt" -ForegroundColor DarkGray
Write-Host "  Output: $OutputFile" -ForegroundColor DarkGray

$payload = @{
    model = $Model
    prompt = $Prompt
    n = 1
    size = $Size
    quality = $Quality
    background = "auto"
    image_detail = $ImageDetail
    output_format = $Format
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $apiKey"
}

try {
    $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $payload -TimeoutSec 60
    if ($response.data -and $response.data[0].b64_json) {
        $base64Data = $response.data[0].b64_json
        $bytes = [Convert]::FromBase64String($base64Data)

        $outputDir = Split-Path -Parent $OutputFile
        if ($outputDir -and !(Test-Path $outputDir)) {
            New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
        }

        [IO.File]::WriteAllBytes($OutputFile, $bytes)
        Write-Host "[Local Image AI] Đã tạo thành công ảnh tại: $OutputFile ($(($bytes.Length / 1024).ToString('0.0')) KB)" -ForegroundColor Green
    } else {
        Write-Error "API không trả về dữ liệu b64_json hợp lệ."
    }
} catch {
    Write-Error "[Local Image AI] Lỗi khi tạo ảnh: $_"
}
