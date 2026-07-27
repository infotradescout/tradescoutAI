$Base = 'https://www.thetradescout.com'
$Bot = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
$wc = New-Object Net.WebClient
$wc.Headers.Add('User-Agent', $Bot)

Write-Output '=== BUSINESS NOINDEX SAMPLE (first 8 from sitemap) ==='
$bizXml = $wc.DownloadString("$Base/sitemap-directory-businesses-0.xml")
[regex]::Matches($bizXml, '<loc>([^<]+)</loc>') | Select-Object -First 8 | ForEach-Object {
    $u = $_.Groups[1].Value
    $html = $wc.DownloadString($u)
    $rob = 'none'
    if ($html -match 'meta name="robots" content="([^"]+)"') { $rob = $Matches[1] }
    $title = '?'
    if ($html -match '<title>([^<]+)</title>') { $title = $Matches[1] }
    Write-Output "$($u.Replace($Base,'')) | robots=$rob"
}

Write-Output ''
Write-Output '=== ALL TRADE SITEMAP URLS - EMPTY ITEMLIST CHECK ==='
$tradeXml = $wc.DownloadString("$Base/sitemap-directory-trades-0.xml")
[regex]::Matches($tradeXml, '<loc>([^<]+)</loc>') | ForEach-Object {
    $u = $_.Groups[1].Value
    $html = $wc.DownloadString($u)
    $empty = $html -match 'itemListElement":\[\]'
    $cnt = ([regex]::Matches($html, '"@type":"ListItem"')).Count
    Write-Output "$($u.Replace($Base,'')) | empty=$empty | items=$cnt"
}

Write-Output ''
$bestC = $wc.DownloadString("$Base/sitemap-best-trade-counties-0.xml")
$bestCity = $wc.DownloadString("$Base/sitemap-best-trade-cities-0.xml")
Write-Output "best-trade-counties-0: $(([regex]::Matches($bestC, '<loc>')).Count)"
Write-Output "best-trade-cities-0: $(([regex]::Matches($bestCity, '<loc>')).Count)"
Write-Output ''
Write-Output 'Landing refs in sitemap-core:'
$core = $wc.DownloadString("$Base/sitemap-core.xml")
[regex]::Matches($core, '<loc>([^<]*landing[^<]*)</loc>') | ForEach-Object { $_.Groups[1].Value }

Write-Output ''
Write-Output '=== COUNTY EMPTY ITEMLIST (sample from sitemap first 5) ==='
$countyXml = $wc.DownloadString("$Base/sitemap-directory-counties.xml")
[regex]::Matches($countyXml, '<loc>([^<]+)</loc>') | Select-Object -First 5 | ForEach-Object {
    $u = $_.Groups[1].Value
    $html = $wc.DownloadString($u)
    $empty = $html -match 'itemListElement":\[\]'
    $cnt = ([regex]::Matches($html, '"@type":"ListItem"')).Count
    Write-Output "$($u.Replace($Base,'')) | empty=$empty | items=$cnt | bodyLen=$((($html -replace '(?is)<script.*?</script>','' -replace '<[^>]+>',' ' -replace '\s+',' ').Trim()).Length)"
}
