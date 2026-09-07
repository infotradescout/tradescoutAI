import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

// Public, read-only diagnostics. Never creates accounts, requests, analytics or payments.
const origin = 'https://www.thetradescout.com';
const output = '.issa-footer-proof';
const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
await fs.mkdir(output, { recursive: true });
const result = { source, checkedAt: new Date().toISOString(), pages: [], discovery: [] };
const browser = await chromium.launch({ headless: true });
try {
  for (const [size, width, height, deviceScaleFactor] of [
    ['desktop', 1440, 1100, 0.5], ['mobile', 390, 844, 1],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height }, deviceScaleFactor,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      serviceWorkers: 'block',
    });
    await context.route('**/*', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(origin + '/issa-build', { waitUntil: 'domcontentloaded', timeout: 60000 });
    assert.equal(response.status(), 200);
    await page.locator('.bp-footer').waitFor({ state: 'visible', timeout: 45000 });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1000);
    const record = { size, errors, ...await page.evaluate(() => ({
      text: document.body.innerText.slice(-9000),
      footer: document.querySelector('.bp-footer')?.outerHTML,
      aside: document.querySelector('.bp-aside')?.outerHTML,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      sections: [...document.querySelectorAll('.bp-aside > *, .bp-footer, footer')].map(element => ({
        tag: element.tagName, className: element.className,
        width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height,
        color: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor,
      })),
    })) };
    result.pages.push(record);
    console.log('ISSA_FOOTER_BEFORE ' + JSON.stringify(record));
    const image = await page.screenshot({ type: 'jpeg', quality: 35, fullPage: false });
    await fs.writeFile(`${output}/footer-${size}.jpg`, image);
    console.log(`ISSA_FOOTER_IMAGE_${size} ` + image.toString('base64'));
    await context.close();
  }
  for (const pathname of ['/api/version', '/issa-build', '/issa-build/onyx', '/pensacola', '/sitemap-u-profiles.xml', '/sitemap-profile-images.xml', '/llms.txt']) {
    const response = await fetch(origin + pathname, { signal: AbortSignal.timeout(20000) });
    const text = await response.text();
    const record = {
      pathname, status: response.status,
      title: text.match(/<title>([\s\S]*?)<\/title>/i)?.[1],
      links: [...text.matchAll(/(?:href|content)="([^"]*issa-build[^"]*)"|<loc>([^<]*issa-build[^<]*)<\/loc>/g)].map(match => match[1] || match[2]),
      text: pathname === '/api/version' ? text : undefined,
    };
    result.discovery.push(record);
    console.log('ISSA_FOOTER_DISCOVERY ' + JSON.stringify(record));
  }
} finally {
  await browser.close();
}
await fs.writeFile(`${output}/result.json`, JSON.stringify(result, null, 2));
await fs.writeFile(`${output}/index.html`, '<!doctype html><html lang="en"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ISSA Build read-only footer review</title><main><h1>Read-only footer review</h1><p>No production changes or customer submissions were made by this diagnostic.</p><a href="https://www.thetradescout.com/issa-build">Open ISSA Build</a><p><a href="result.json">Diagnostic record</a></p></main></html>');
console.log('ISSA_FOOTER_AUDIT_COMPLETE ' + JSON.stringify({ source, pages: result.pages.length, discovery: result.discovery.length }));
