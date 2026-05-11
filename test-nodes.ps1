# ============================================================
# Steem Node Benchmark — 22 API calls x 10 nodes
# Usage: powershell -ExecutionPolicy Bypass -File test-nodes.ps1
# Results saved to test-nodes-results.txt
# ============================================================

$nodes = @(
    "https://api.wherein.io",
    "https://api.justyy.com",
    "https://api.steemyy.com",
    "https://api.moecki.online",
    "https://api.steemit.com",
    "https://api3.justyy.com",
    "https://api.steemitdev.com",
    "https://api.pennsif.net",
    "https://steemd.steemworld.org",
    "https://steemyy.com/node/"
)

$tests = [ordered]@{
    "condenser.get_accounts"             = '{"jsonrpc":"2.0","method":"condenser_api.get_accounts","params":[["steemit"]],"id":1}'
    "condenser.get_dynamic_global_props" = '{"jsonrpc":"2.0","method":"condenser_api.get_dynamic_global_properties","params":[],"id":1}'
    "condenser.get_discussions_trending" = '{"jsonrpc":"2.0","method":"condenser_api.get_discussions_by_trending","params":[{"tag":"steem","limit":1}],"id":1}'
    "condenser.get_discussions_hot"      = '{"jsonrpc":"2.0","method":"condenser_api.get_discussions_by_hot","params":[{"tag":"steem","limit":1}],"id":1}'
    "condenser.get_discussions_created"  = '{"jsonrpc":"2.0","method":"condenser_api.get_discussions_by_created","params":[{"tag":"steem","limit":1}],"id":1}'
    "condenser.get_discussions_promoted" = '{"jsonrpc":"2.0","method":"condenser_api.get_discussions_by_promoted","params":[{"tag":"steem","limit":1}],"id":1}'
    "condenser.get_discussions_blog"     = '{"jsonrpc":"2.0","method":"condenser_api.get_discussions_by_blog","params":[{"tag":"steemit","limit":1}],"id":1}'
    "condenser.get_discussions_comments" = '{"jsonrpc":"2.0","method":"condenser_api.get_discussions_by_comments","params":[{"start_author":"steemit","limit":1}],"id":1}'
    "condenser.get_content"              = '{"jsonrpc":"2.0","method":"condenser_api.get_content","params":["steemit","firstpost"],"id":1}'
    "condenser.get_content_replies"      = '{"jsonrpc":"2.0","method":"condenser_api.get_content_replies","params":["steemit","firstpost"],"id":1}'
    "condenser.get_trending_tags"        = '{"jsonrpc":"2.0","method":"condenser_api.get_trending_tags","params":["",5],"id":1}'
    "condenser.lookup_accounts"          = '{"jsonrpc":"2.0","method":"condenser_api.lookup_accounts","params":["steem",5],"id":1}'
    "condenser.get_active_votes"         = '{"jsonrpc":"2.0","method":"condenser_api.get_active_votes","params":["steemit","firstpost"],"id":1}'
    "condenser.get_reward_fund"          = '{"jsonrpc":"2.0","method":"condenser_api.get_reward_fund","params":["post"],"id":1}'
    "condenser.get_median_price"         = '{"jsonrpc":"2.0","method":"condenser_api.get_current_median_history_price","params":[],"id":1}'
    "condenser.get_account_history"      = '{"jsonrpc":"2.0","method":"condenser_api.get_account_history","params":["steemit",-1,5],"id":1}'
    "condenser.get_vesting_delegations"  = '{"jsonrpc":"2.0","method":"condenser_api.get_vesting_delegations","params":["steemit",null,5],"id":1}'
    "follow.get_reblogged_by"            = '{"jsonrpc":"2.0","method":"follow_api.get_reblogged_by","params":{"author":"rme","permlink":"fun-meme-puss-logo-meme-banner-part-414-946-1778503804"},"id":1}'
    "follow.get_followers"               = '{"jsonrpc":"2.0","method":"follow_api.get_followers","params":{"account":"steemit","start":"","type":"blog","limit":3},"id":1}'
    "follow.get_following"               = '{"jsonrpc":"2.0","method":"follow_api.get_following","params":{"account":"steemit","start":"","type":"blog","limit":3},"id":1}'
    "bridge.get_ranked_posts"            = '{"jsonrpc":"2.0","method":"bridge.get_ranked_posts","params":{"tag":"hive-196037","sort":"trending","limit":1},"id":1}'
    "rc_api.find_rc_accounts"            = '{"jsonrpc":"2.0","method":"rc_api.find_rc_accounts","params":{"accounts":["steemit"]},"id":1}'
}

$pad = 36
$results = @{}
foreach ($node in $nodes) { $results[$node] = @{} }

# Abbreviazioni nodi per intestazione
function Short-Node($url) {
    $url -replace "https://" `
         -replace "api\." `
         -replace "steemd\." `
         -replace "\.online|\.com|\.net|\.io|\.org" `
         -replace "/node/" `
         -replace "/"
}

$lines = [System.Collections.Generic.List[string]]::new()

function Log($text) {
    Write-Host $text
    $lines.Add($text)
}

# Header
$header = ("{0,-$pad}" -f "TEST")
foreach ($node in $nodes) {
    $short = Short-Node $node
    $header += ("{0,13}" -f $short)
}
Log $header
Log ("-" * ($pad + $nodes.Count * 13))

# Test loop
foreach ($testName in $tests.Keys) {
    $row = ("{0,-$pad}" -f $testName)
    Write-Host ("{0,-$pad}" -f $testName) -NoNewline -ForegroundColor White

    foreach ($node in $nodes) {
        try {
            $start = Get-Date
            $r = Invoke-RestMethod -Uri $node -Method POST -ContentType "application/json" -Body $tests[$testName] -TimeoutSec 7
            $ms = [int]((Get-Date) - $start).TotalMilliseconds

            if ($null -ne $r.result) {
                Write-Host ("{0,13}" -f "OK ${ms}ms") -NoNewline -ForegroundColor Green
                $row += ("{0,13}" -f "OK ${ms}ms")
                $results[$node][$testName] = $ms
            } else {
                $code = $r.error.code
                Write-Host ("{0,13}" -f "ERR $code") -NoNewline -ForegroundColor Red
                $row += ("{0,13}" -f "ERR $code")
                $results[$node][$testName] = -1
            }
        } catch {
            Write-Host ("{0,13}" -f "FAIL") -NoNewline -ForegroundColor DarkRed
            $row += ("{0,13}" -f "FAIL")
            $results[$node][$testName] = -1
        }
    }
    Write-Host ""
    $lines.Add($row)
}

Log ("-" * ($pad + $nodes.Count * 13))

# Riepilogo
$sumRow = ("{0,-$pad}" -f "Chiamate OK / $($tests.Count)")
Write-Host "`n===== RIEPILOGO =====" -ForegroundColor Yellow
Write-Host ("{0,-$pad}" -f "Chiamate OK / $($tests.Count)") -NoNewline -ForegroundColor White

foreach ($node in $nodes) {
    $ok = ($results[$node].Values | Where-Object { $_ -ge 0 }).Count
    $color = if ($ok -eq $tests.Count) { "Green" } elseif ($ok -gt $tests.Count * 0.7) { "Yellow" } else { "Red" }
    Write-Host ("{0,13}" -f "$ok/$($tests.Count)") -NoNewline -ForegroundColor $color
    $sumRow += ("{0,13}" -f "$ok/$($tests.Count)")
}
Write-Host ""
$lines.Add("")
$lines.Add("===== RIEPILOGO =====")
$lines.Add($sumRow)

$latRow = ("{0,-$pad}" -f "Latenza media (ms)")
Write-Host ("{0,-$pad}" -f "Latenza media (ms)") -NoNewline -ForegroundColor White
foreach ($node in $nodes) {
    $times = $results[$node].Values | Where-Object { $_ -ge 0 }
    if ($times.Count -gt 0) {
        $avg = [int](($times | Measure-Object -Average).Average)
        Write-Host ("{0,13}" -f "${avg}ms") -NoNewline -ForegroundColor Cyan
        $latRow += ("{0,13}" -f "${avg}ms")
    } else {
        Write-Host ("{0,13}" -f "N/A") -NoNewline -ForegroundColor DarkGray
        $latRow += ("{0,13}" -f "N/A")
    }
}
Write-Host ""
$lines.Add($latRow)

# Salva su file
$outFile = Join-Path $PSScriptRoot "test-nodes-results.txt"
$lines | Set-Content -Path $outFile -Encoding UTF8
Write-Host "`nRisultati salvati in: $outFile" -ForegroundColor Yellow
