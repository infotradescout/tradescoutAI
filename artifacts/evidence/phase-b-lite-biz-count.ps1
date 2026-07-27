$Base = 'https://www.thetradescout.com'
$Bot = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
$wc = New-Object Net.WebClient
$wc.Headers.Add('User-Agent', $Bot)
$bizXml = $wc.DownloadString("$Base/sitemap-directory-businesses-0.xml")
$urls = [regex]::Matches($bizXml, '<loc>([^<]+)</loc>') | ForEach-Object { $_.Groups[1].Value }
$noindex = 0; $index = 0; $other = 0
foreach ($u in $urls) {
    $html = $wc.DownloadString($u)
    if ($html -match 'meta name="robots" content="([^"]+)"') {
        if ($Matches[1] -match 'noindex') { $noindex++ } elseif ($Matches[1] -match 'index') { $index++ } else { $other++ }
    } else { $other++ }
}
Write-Output "Business sitemap total: $($urls.Count)"
Write-Output "noindex: $noindex | index: $index | other: $other"
