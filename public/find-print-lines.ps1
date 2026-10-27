$content = Get-Content -Path "C:\Users\USER\OneDrive\Desktop\HotelSystem\public\component\orders-workspace.js" -Encoding utf8
$i = 0
foreach ($line in $content) {
    $i++
    if ($line -match "function printOrderById" -or $line -match "function printCurrentCart" -or $line -match "function printCurrentTab") {
        Write-Host "Line $i: $line"
    }
}