$Base = 'https://www.thetradescout.com'
$Browser = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
$Bot = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

function Get-PageInfo {
    param([string]$Url, [string]$UA)
    $info = [ordered]@{ url = $Url; ua = $UA; status = $null; robots = $null; canonical = $null; title = $null; h1 = $null; bodyLen = 0; itemListEmpty = $null; error = $null }
    try {
        $req = [Net.HttpWebRequest]::Create($Url)
        $req.UserAgent = $UA
        $req.Timeout = 45000
        $req.AutomaticDecompression = [Net.DecompressionMethods]::GZip -bor [Net.DecompressionMethods]::Deflate
        $resp = $req.GetResponse()
        $info.status = [int]$resp.StatusCode
        $sr = New-Object IO.StreamReader($resp.GetResponseStream())
        $html = $sr.ReadToEnd()
        $resp.Close()
    } catch {
        if ($_.Exception.Response) {
            $info.status = [int]$_.Exception.Response.StatusCode
            try {
                $sr = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
                $html = $sr.ReadToEnd()
            } catch { $info.error = $_.Exception.Message; return [pscustomobject]$info }
        } else { $info.error = $_.Exception.Message; return [pscustomobject]$info }
    }
    if ($html -match '(?is)<title[^>]*>(.*?)</title>') { $info.title = ($Matches[1] -replace '\s+',' ').Trim() }
    if ($html -match '(?is)<meta\s+name="robots"\s+content="([^"]+)"') { $info.robots = $Matches[1] }
    if ($html -match '(?is)<link\s+rel="canonical"\s+href="([^"]+)"') { $info.canonical = $Matches[1] }
    if ($html -match '(?is)<h1[^>]*>(.*?)</h1>') { $info.h1 = ($Matches[1] -replace '<[^>]+>','' -replace '\s+',' ').Trim() }
    if ($html -match '(?is)"itemListElement"\s*:\s*\[\s*\]') { $info.itemListEmpty = $true }
    elseif ($html -match '(?is)"itemListElement"\s*:\s*\[') { $info.itemListEmpty = $false }
    $text = $html -replace '(?is)<script[^>]*>.*?</script>','' -replace '(?is)<style[^>]*>.*?</style>','' -replace '<[^>]+>',' ' -replace '\s+',' '
    $info.bodyLen = $text.Trim().Length
    return [pscustomobject]$info
}

$probeUrls = @(
    '/business/2h-v-construction-services-llc-2',
    '/trade/plumbing/fl/bay',
    '/trade/plumbing/al/baldwin',
    '/county/ms/harrison',
    '/best/electrical/fl/bay',
    '/u/nonexistent-slug-test-404',
    '/u/super-admin',
    '/homescout/listings/test',
    '/exchange/smokecategory-1773022418828',
    '/tradepartners/escambia-fl',
    '/city/fl/pensacola',
    '/direct-connect-info'
)

Write-Output '=== SUPPLEMENT PROBE ==='
foreach ($p in $probeUrls) {
    $u = "$Base$p"
    $b = Get-PageInfo -Url $u -UA $Browser
    $g = Get-PageInfo -Url $u -UA $Bot
    Write-Output "$p | status b=$($b.status) g=$($g.status) | body b=$($b.bodyLen) g=$($g.bodyLen) | robots=$($g.robots) | emptyList=$($g.itemListEmpty) | title=$($g.title)"
}

# Landing duplicate comparison
Write-Output ''
Write-Output '=== LANDING PHRASE COMPARISON (Googlebot body snippets) ==='
$landings = @('/landing','/landing/homeowner-hvac','/landing/supplier-addition-contractor')
$snips = @{}
foreach ($p in $landings) {
    $g = Get-PageInfo -Url "$Base$p" -UA $Bot
    $wc = New-Object Net.WebClient; $wc.Headers.Add('User-Agent', $Bot)
    $html = $wc.DownloadString("$Base$p")
    if ($html -match '(?is)<h1[^>]*>(.*?)</h1>') { $h1 = ($Matches[1] -replace '<[^>]+>','').Trim() }
    if ($html -match '(?is)<meta\s+name="description"\s+content="([^"]*)"') { $desc = $Matches[1] }
    Write-Output "$p => h1='$h1' desc='$desc'"
}

# Count directory businesses
Write-Output ''
Write-Output '=== SITEMAP URL TOTALS (leaf counts) ==='
$smFiles = @(
    'sitemap-core.xml','sitemap-u-profiles.xml','sitemap-business-profiles.xml',
    'sitemap-directory-businesses-0.xml','sitemap-directory-counties.xml',
    'sitemap-directory-trades-0.xml','sitemap-directory-cities-0.xml',
    'sitemap-directory-trade-cities-0.xml','sitemap-homescout-counties.xml',
    'sitemap-homescout-listings.xml','sitemap-tradepartners.xml',
    'sitemap-best-trade-counties.xml','sitemap-best-trade-cities.xml',
    'sitemap-exchange-listings.xml','sitemap-recent-activity.xml',
    'sitemap-handmade-products.xml','sitemap-profile-service-offers.xml',
    'sitemap-directory-trade-navigation.xml'
)
$total = 0
foreach ($sm in $smFiles) {
    try {
        $wc = New-Object Net.WebClient; $wc.Headers.Add('User-Agent', $Browser)
        $xml = $wc.DownloadString("$Base/$sm")
        $count = ([regex]::Matches($xml, '<loc>')).Count
        $total += $count
        Write-Output "$sm : $count"
    } catch { Write-Output "$sm : ERROR" }
}
Write-Output "GRAND TOTAL (leaf sitemaps, may overlap index refs): $total"
