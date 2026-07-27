# Phase B-lite LIVE crawl helper - read-only
$ErrorActionPreference = 'Continue'
$Base = 'https://www.thetradescout.com'
$BrowserUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
$GooglebotUA = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

function Get-SeoMeta {
    param([string]$Html)
    $meta = @{}
    if ($Html -match '(?is)<title[^>]*>(.*?)</title>') { $meta.title = ($Matches[1] -replace '\s+',' ').Trim() }
    if ($Html -match '(?is)<meta\s+name=["'']robots["'']\s+content=["'']([^"'']+)["'']') { $meta.robots = $Matches[1] }
    if ($Html -match '(?is)<meta\s+name=["'']googlebot["'']\s+content=["'']([^"'']+)["'']') { $meta.googlebot = $Matches[1] }
    if ($Html -match '(?is)<meta\s+name=["'']description["'']\s+content=["'']([^"'']*)["'']') { $meta.description = $Matches[1] }
    if ($Html -match '(?is)<link\s+rel=["'']canonical["'']\s+href=["'']([^"'']+)["'']') { $meta.canonical = $Matches[1] }
    if ($Html -match '(?is)<h1[^>]*>(.*?)</h1>') { $meta.h1 = ($Matches[1] -replace '<[^>]+>','' -replace '\s+',' ').Trim() }
    $text = $Html -replace '(?is)<script[^>]*>.*?</script>','' -replace '(?is)<style[^>]*>.*?</style>','' -replace '<[^>]+>',' ' -replace '\s+',' '
    $meta.bodyLen = $text.Trim().Length
    return $meta
}

function Fetch-Url {
    param([string]$Url, [string]$UA)
    $result = [ordered]@{
        url = $Url
        ua = if ($UA -like '*Googlebot*') { 'googlebot-smartphone' } else { 'browser' }
        status = $null
        redirects = @()
        contentType = $null
        xRobots = $null
        title = $null
        robots = $null
        googlebot = $null
        description = $null
        canonical = $null
        h1 = $null
        bodyLen = 0
        error = $null
    }
    try {
        $uri = [Uri]$Url
        $current = $Url
        $max = 10
        for ($i = 0; $i -lt $max; $i++) {
            $req = [System.Net.HttpWebRequest]::Create($current)
            $req.Method = 'GET'
            $req.UserAgent = $UA
            $req.AllowAutoRedirect = $false
            $req.Timeout = 45000
            $req.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate
            $resp = $req.GetResponse()
            $status = [int]$resp.StatusCode
            $ct = $resp.ContentType
            $xrob = $resp.Headers['X-Robots-Tag']
            $resp.Close()
            if ($status -ge 300 -and $status -lt 400) {
                $loc = $req.Headers['Location']
                if (-not $loc) { $loc = $resp.Headers['Location'] }
                if ($loc -and -not $loc.StartsWith('http')) {
                    $baseUri = [Uri]$current
                    $loc = (New-Object Uri($baseUri, $loc)).AbsoluteUri
                }
                $result.redirects += "$status -> $loc"
                $current = $loc
                continue
            }
            $result.status = $status
            $result.contentType = $ct
            $result.xRobots = $xrob
            # re-fetch with redirect following for body
            $wc = New-Object System.Net.WebClient
            $wc.Headers.Add('User-Agent', $UA)
            $html = $wc.DownloadString($Url)
            $seo = Get-SeoMeta -Html $html
            $result.title = $seo.title
            $result.robots = $seo.robots
            $result.googlebot = $seo.googlebot
            $result.description = $seo.description
            $result.canonical = $seo.canonical
            $result.h1 = $seo.h1
            $result.bodyLen = $seo.bodyLen
            break
        }
    } catch {
        $ex = $_.Exception
        if ($ex.Response) {
            $result.status = [int]$ex.Response.StatusCode
            $result.contentType = $ex.Response.ContentType
            $result.xRobots = $ex.Response.Headers['X-Robots-Tag']
            try {
                $sr = New-Object System.IO.StreamReader($ex.Response.GetResponseStream())
                $html = $sr.ReadToEnd()
                $seo = Get-SeoMeta -Html $html
                $result.title = $seo.title
                $result.robots = $seo.robots
                $result.googlebot = $seo.googlebot
                $result.description = $seo.description
                $result.canonical = $seo.canonical
                $result.h1 = $seo.h1
                $result.bodyLen = $seo.bodyLen
            } catch {}
        } else {
            $result.error = $ex.Message
        }
    }
    return [pscustomobject]$result
}

function Count-SitemapUrls {
    param([string]$SitemapUrl, [hashtable]$Seen = @{})
    if ($Seen.ContainsKey($SitemapUrl)) { return @{ count = 0; patterns = @{}; samples = @(); nested = @() } }
    $Seen[$SitemapUrl] = $true
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add('User-Agent', $BrowserUA)
    $xml = $wc.DownloadString($SitemapUrl)
    $total = 0
    $patterns = @{}
    $samples = @()
    $nested = @()
    if ($xml -match '<sitemapindex') {
        [regex]::Matches($xml, '<loc>([^<]+)</loc>') | ForEach-Object {
            $child = $_.Groups[1].Value
            $nested += $child
            $sub = Count-SitemapUrls -SitemapUrl $child -Seen $Seen
            $total += $sub.count
        }
        return @{ count = $total; patterns = $patterns; samples = $samples; nested = $nested; type = 'index' }
    }
    [regex]::Matches($xml, '<loc>([^<]+)</loc>') | ForEach-Object {
        $u = $_.Groups[1].Value
        $total++
        if ($samples.Count -lt 5) { $samples += $u }
        $path = $u -replace [regex]::Escape($Base), ''
        $parts = ($path -split '/' | Where-Object { $_ })
        $pat = if ($parts.Count -ge 2) { "/$($parts[0])/$($parts[1])/..." } elseif ($parts.Count -eq 1) { "/$($parts[0])/..." } else { '/' }
        if ($patterns.ContainsKey($pat)) { $patterns[$pat]++ } else { $patterns[$pat] = 1 }
    }
    return @{ count = $total; patterns = $patterns; samples = $samples; nested = @(); type = 'urlset' }
}

# Run sitemap counts
Write-Output '=== SITEMAP COUNTS ==='
$indexChildren = @(
    'sitemap-core.xml','sitemap-profiles.xml','sitemap-homescout-counties.xml','sitemap-homescout-listings.xml',
    'sitemap-tradepartners.xml','sitemap-directory-counties.xml','sitemap-directory-trade-navigation.xml',
    'sitemap-directory-trades.xml','sitemap-directory-cities.xml','sitemap-directory-trade-cities.xml',
    'sitemap-best-pages.xml','sitemap-recent-activity.xml','sitemap-exchange-listings.xml',
    'sitemap-handmade-products.xml','sitemap-profile-service-offers.xml'
)
$sitemapReport = @()
foreach ($sm in $indexChildren) {
    $url = "$Base/$sm"
    $info = Count-SitemapUrls -SitemapUrl $url
    $topPatterns = ($info.patterns.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 5 | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join '; '
    Write-Output "$sm : $($info.count) URLs | patterns: $topPatterns"
    if ($info.nested.Count -gt 0) {
        foreach ($n in $info.nested) {
            $sub = Count-SitemapUrls -SitemapUrl $n
            $subPat = ($sub.patterns.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 3 | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join '; '
            Write-Output "  -> $($n.Split('/')[-1]): $($sub.count) | $subPat"
        }
    }
    $sitemapReport += [pscustomobject]@{ sitemap = $sm; count = $info.count; samples = ($info.samples -join ', ') }
}

# Discover landing URLs from core + probe
$landingProbe = @('/landing/homeowner-hvac','/landing/supplier-addition-contractor')
# Get u profile sample
$wc2 = New-Object System.Net.WebClient
$wc2.Headers.Add('User-Agent', $BrowserUA)
$uXml = $wc2.DownloadString("$Base/sitemap-u-profiles.xml")
$uSamples = [regex]::Matches($uXml, '<loc>([^<]+)</loc>') | Select-Object -First 3 | ForEach-Object { $_.Groups[1].Value }
$bizXml = $wc2.DownloadString("$Base/sitemap-business-profiles.xml")
$bizSample = ([regex]::Matches($bizXml, '<loc>([^<]+)</loc>') | Select-Object -First 1).Groups[1].Value
$tradeXml = $wc2.DownloadString("$Base/sitemap-directory-trades-0.xml")
$tradeSamples = [regex]::Matches($tradeXml, '<loc>([^<]+)</loc>') | Select-Object -First 3 | ForEach-Object { $_.Groups[1].Value }
$countyXml = $wc2.DownloadString("$Base/sitemap-directory-counties.xml")
$countySample = ([regex]::Matches($countyXml, '<loc>([^<]+)</loc>') | Select-Object -First 1).Groups[1].Value

$urls = @(
    '/',
    '/direct-connect',
    '/scout',
    '/auth',
    '/dashboard',
    '/community',
    '/exchange',
    '/landing',
    '/landing/homeowner-hvac',
    '/landing/supplier-addition-contractor',
    '/trade',
    '/county-directory',
    '/u/nonexistent-slug-test-404',
    '/search',
    '/contractors'
) + $uSamples + @($bizSample) + $tradeSamples + @($countySample)

$urls = $urls | Where-Object { $_ } | Select-Object -Unique

Write-Output ''
Write-Output '=== URL CRAWL ==='
$results = @()
foreach ($path in $urls) {
    $full = if ($path.StartsWith('http')) { $path } else { "$Base$path" }
    Write-Output "Crawling $full ..."
    $b = Fetch-Url -Url $full -UA $BrowserUA
    $g = Fetch-Url -Url $full -UA $GooglebotUA
    $results += [pscustomobject]@{
        url = $full
        b_status = $b.status; g_status = $g.status
        b_redirects = ($b.redirects -join ' | '); g_redirects = ($g.redirects -join ' | ')
        b_ct = $b.contentType; g_ct = $g.contentType
        b_xrobots = $b.xRobots; g_xrobots = $g.xRobots
        b_robots = $b.robots; g_robots = $g.robots
        b_googlebot = $b.googlebot; g_googlebot = $g.googlebot
        b_canonical = $b.canonical; g_canonical = $g.canonical
        b_title = $b.title; g_title = $g.title
        b_desc = $b.description; g_desc = $g.description
        b_h1 = $b.h1; g_h1 = $g.h1
        b_bodyLen = $b.bodyLen; g_bodyLen = $g.bodyLen
        ua_diff = ($b.status -ne $g.status) -or ($b.robots -ne $g.robots) -or ($b.title -ne $g.title) -or ($b.bodyLen -ne $g.bodyLen) -or ($b.xRobots -ne $g.xRobots)
    }
}

$results | Format-Table -AutoSize url, b_status, g_status, b_robots, b_xrobots, b_bodyLen, g_bodyLen, ua_diff
$results | ConvertTo-Json -Depth 5 | Out-File "$PSScriptRoot\phase-b-lite-crawl-results.json" -Encoding utf8
Write-Output "Results written to phase-b-lite-crawl-results.json"
