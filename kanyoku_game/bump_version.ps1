<#
.SYNOPSIS
バージョン更新スクリプト (v1.0 -> v1.1 のように 0.1 刻みで増やす)

.DESCRIPTION
index.html 内の <div class="app-version">v1.0</div> のような表記を探し、
数値を0.1足して上書き保存します。
#>

$htmlFile = "index.html"

if (-Not (Test-Path $htmlFile)) {
    Write-Host "エラー: $htmlFile が見つかりません。"
    exit 1
}

# ファイルを読み込み
$content = Get-Content $htmlFile -Raw

# 現在のバージョンを正規表現で探す
if ($content -match '<div class="app-version">v([0-9]+\.[0-9]+)</div>') {
    $currentVersion = $matches[1]
    
    # 0.1 を足す
    [double]$newVersionNum = [double]$currentVersion + 0.1
    # 小数第1位までにフォーマット
    $newVersion = "{0:N1}" -f $newVersionNum

    Write-Host "バージョンを更新します: v$currentVersion -> v$newVersion"

    # 置換して保存
    $newContent = $content -replace '<div class="app-version">v' + $currentVersion + '</div>', '<div class="app-version">v' + $newVersion + '</div>'
    Set-Content -Path $htmlFile -Value $newContent -Encoding UTF8

    Write-Host "完了しました。"
} else {
    Write-Host "エラー: index.html 内に <div class=\"app-version\">vX.X</div> の表記が見つかりませんでした。"
    exit 1
}
