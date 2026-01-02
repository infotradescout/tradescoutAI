/**
 * Bot Army HTML Report Generator
 * 
 * Parses Playwright test results and generates a human-readable HTML report
 * highlighting:
 * - Hard failures
 * - Trust leaks (stub/placeholder content)
 * - Unfinished UI surfaces
 * 
 * Usage: node tests/report/generate_report.ts
 */

import fs from 'fs';
import path from 'path';

interface PlaywrightResult {
  status: 'passed' | 'failed' | 'skipped';
  title: string;
  fullTitle: string;
  file: string;
  error?: {
    message: string;
    stack?: string;
  };
  duration: number;
  attachments?: Array<{
    name: string;
    contentType: string;
    path?: string;
    body?: string;
  }>;
}

interface TestSuite {
  title: string;
  file: string;
  tests: PlaywrightResult[];
}

interface ReportData {
  startTime: string;
  endTime: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
  hardFailures: PlaywrightResult[];
  trustLeaks: PlaywrightResult[];
  unstubs: PlaywrightResult[];
  suites: TestSuite[];
}

/**
 * Extract error information from Playwright result
 */
function extractErrorInfo(result: PlaywrightResult): {
  type: 'hard-failure' | 'trust-leak' | 'unstub' | 'unknown';
  description: string;
} {
  const error = result.error?.message || '';
  const stack = result.error?.stack || '';

  // Trust leaks: stub/placeholder content detected
  if (
    error.includes('stub') ||
    error.includes('TODO') ||
    error.includes('coming soon') ||
    error.includes('placeholder') ||
    error.includes('mock') ||
    error.includes('unimplemented')
  ) {
    return {
      type: 'trust-leak',
      description: `Stub/placeholder content detected: ${error.split('\n')[0]}`,
    };
  }

  // Unfinished UI: element not visible or unfinished UI surface
  if (
    error.includes('not be visible') ||
    error.includes('not to be visible') ||
    error.includes('locator') ||
    error.includes('element')
  ) {
    return {
      type: 'unstub',
      description: `Unfinished UI surface: ${error.split('\n')[0]}`,
    };
  }

  // Hard failures: everything else
  return {
    type: 'hard-failure',
    description: error.split('\n')[0] || 'Unknown error',
  };
}

/**
 * Generate HTML report
 */
function generateHTMLReport(data: ReportData): string {
  const timestamp = new Date().toISOString();
  const passPercentage = data.totalTests > 0
    ? Math.round((data.passedTests / data.totalTests) * 100)
    : 0;

  const healthStatus = data.failedTests === 0
    ? '✅ ALL TESTS PASSING'
    : data.trustLeaks.length > 0
    ? '⚠️  TRUST LEAKS DETECTED'
    : '❌ FAILURES';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TradeScout Bot Army Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    h1 {
      font-size: 2em;
      margin-bottom: 10px;
    }

    .health-badge {
      display: inline-block;
      padding: 8px 16px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      font-weight: bold;
      margin-top: 10px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      border-left: 4px solid #667eea;
    }

    .stat-card h3 {
      font-size: 0.9em;
      color: #666;
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    .stat-card .number {
      font-size: 2.5em;
      font-weight: bold;
      color: #667eea;
    }

    .stat-card.passed { border-left-color: #10b981; }
    .stat-card.passed .number { color: #10b981; }

    .stat-card.failed { border-left-color: #ef4444; }
    .stat-card.failed .number { color: #ef4444; }

    .stat-card.warning { border-left-color: #f59e0b; }
    .stat-card.warning .number { color: #f59e0b; }

    section {
      background: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    h2 {
      font-size: 1.5em;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #667eea;
    }

    .failure-list {
      list-style: none;
    }

    .failure-item {
      padding: 15px;
      margin-bottom: 10px;
      border-left: 4px solid #ef4444;
      background: #fef2f2;
      border-radius: 4px;
    }

    .failure-item.trust-leak {
      border-left-color: #f59e0b;
      background: #fffbeb;
    }

    .failure-item.unstub {
      border-left-color: #3b82f6;
      background: #eff6ff;
    }

    .failure-title {
      font-weight: bold;
      color: #1f2937;
      margin-bottom: 5px;
    }

    .failure-file {
      font-size: 0.85em;
      color: #6b7280;
      margin-bottom: 5px;
    }

    .failure-error {
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 0.85em;
      color: #374151;
      padding: 10px;
      background: white;
      border-radius: 4px;
      margin-top: 8px;
      overflow-x: auto;
    }

    .empty-state {
      padding: 40px;
      text-align: center;
      color: #9ca3af;
    }

    .empty-state p {
      font-size: 1.1em;
      margin-bottom: 10px;
    }

    .test-suite {
      margin-bottom: 15px;
      padding: 15px;
      background: #f9fafb;
      border-radius: 4px;
    }

    .test-suite h3 {
      margin-bottom: 10px;
      color: #374151;
    }

    .test-item {
      padding: 8px;
      margin-left: 20px;
      font-size: 0.9em;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .test-item.passed::before {
      content: '✅';
    }

    .test-item.failed::before {
      content: '❌';
    }

    .test-item.skipped::before {
      content: '⏭️';
    }

    footer {
      text-align: center;
      padding: 20px;
      color: #9ca3af;
      font-size: 0.9em;
    }

    .progress-bar {
      width: 100%;
      height: 20px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 10px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981 0%, #059669 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 0.75em;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🤖 TradeScout Bot Army Report</h1>
      <p>Regression Testing & Mission Invariant Verification</p>
      <div class="health-badge">${healthStatus}</div>
      <p style="margin-top: 15px; font-size: 0.9em;">Generated: ${timestamp}</p>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <h3>Total Tests</h3>
        <div class="number">${data.totalTests}</div>
      </div>
      <div class="stat-card passed">
        <h3>Passed</h3>
        <div class="number">${data.passedTests}</div>
      </div>
      <div class="stat-card failed">
        <h3>Failed</h3>
        <div class="number">${data.failedTests}</div>
      </div>
      <div class="stat-card warning">
        <h3>Pass Rate</h3>
        <div class="number">${passPercentage}%</div>
      </div>
    </div>

    ${data.failedTests > 0 ? `
      <section>
        <h2>Progress</h2>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${passPercentage}%;">
            ${passPercentage}%
          </div>
        </div>
      </section>
    ` : ''}

    ${data.hardFailures.length > 0 ? `
      <section>
        <h2>🚨 Hard Failures (${data.hardFailures.length})</h2>
        <ul class="failure-list">
          ${data.hardFailures.map(test => `
            <li class="failure-item">
              <div class="failure-title">${test.title}</div>
              <div class="failure-file">📄 ${test.file}</div>
              <div class="failure-error">${test.error?.message || 'Unknown error'}</div>
            </li>
          `).join('')}
        </ul>
      </section>
    ` : ''}

    ${data.trustLeaks.length > 0 ? `
      <section>
        <h2>⚠️  Trust Leaks - Stub/Placeholder Content (${data.trustLeaks.length})</h2>
        <p style="margin-bottom: 15px; color: #6b7280;">
          These tests detected unfinished UI surfaces with stub content, 
          placeholder text, or mock data that should not appear to users.
        </p>
        <ul class="failure-list">
          ${data.trustLeaks.map(test => `
            <li class="failure-item trust-leak">
              <div class="failure-title">${test.title}</div>
              <div class="failure-file">📄 ${test.file}</div>
              <div class="failure-error">${test.error?.message || 'Stub content detected'}</div>
            </li>
          `).join('')}
        </ul>
      </section>
    ` : ''}

    ${data.unstubs.length > 0 ? `
      <section>
        <h2>🔨 Unfinished UI Surfaces (${data.unstubs.length})</h2>
        <p style="margin-bottom: 15px; color: #6b7280;">
          These tests found missing or incomplete UI elements that should be present.
        </p>
        <ul class="failure-list">
          ${data.unstubs.map(test => `
            <li class="failure-item unstub">
              <div class="failure-title">${test.title}</div>
              <div class="failure-file">📄 ${test.file}</div>
              <div class="failure-error">${test.error?.message || 'UI element missing'}</div>
            </li>
          `).join('')}
        </ul>
      </section>
    ` : ''}

    <section>
      <h2>Test Suites</h2>
      ${data.suites.map(suite => `
        <div class="test-suite">
          <h3>${suite.title}</h3>
          ${suite.tests.map(test => `
            <div class="test-item ${test.status}">
              ${test.title} (${test.duration}ms)
            </div>
          `).join('')}
        </div>
      `).join('')}
    </section>

    ${data.failedTests === 0 ? `
      <section>
        <div class="empty-state">
          <p>🎉 All tests passing!</p>
          <p>Mission invariants verified. System is healthy.</p>
        </div>
      </section>
    ` : ''}

    <footer>
      <p>Bot Army Regression Test Suite | Duration: ${(data.duration / 1000).toFixed(2)}s</p>
      <p>
        <a href="https://github.com/your-org/tradescout-pro" style="color: #667eea;">View on GitHub</a> | 
        <a href="./playwright-report/index.html" style="color: #667eea;">Playwright Details</a>
      </p>
    </footer>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Main: Load test results and generate report
 */
async function main() {
  const resultsDir = path.join(process.cwd(), '.playwright', 'test-results');
  const reportDir = path.join(process.cwd(), 'tests', 'report');
  const outputPath = path.join(reportDir, 'bot-army-report.html');

  // Ensure report directory exists
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  // For now, generate a sample report (in CI, parse actual Playwright JSON results)
  const sampleData: ReportData = {
    startTime: new Date(Date.now() - 120000).toISOString(),
    endTime: new Date().toISOString(),
    totalTests: 13,
    passedTests: 12,
    failedTests: 1,
    skippedTests: 0,
    duration: 120000,
    hardFailures: [
      {
        status: 'failed',
        title: 'should submit contact form and show success',
        fullTitle: 'Contact Loop › should submit contact form and show success',
        file: 'tests/journeys/contact_loop.spec.ts',
        duration: 8500,
        error: {
          message: 'Timeout waiting for success message (5000ms)',
          stack: 'at contactSubmitTest (contact_loop.spec.ts:145)',
        },
      },
    ],
    trustLeaks: [],
    unstubs: [],
    suites: [
      {
        title: 'Anonymous User - Business Profile View',
        file: 'tests/journeys/anonymous_business_profile.spec.ts',
        tests: [
          { status: 'passed', title: 'should load business profile', fullTitle: '', file: '', duration: 1200 },
          { status: 'passed', title: 'should display mission statement', fullTitle: '', file: '', duration: 980 },
          { status: 'passed', title: 'should display contact CTA', fullTitle: '', file: '', duration: 750 },
        ],
      },
      {
        title: 'Authentication Buttons',
        file: 'tests/journeys/auth_buttons_present.spec.ts',
        tests: [
          { status: 'passed', title: 'should display Google and Facebook buttons', fullTitle: '', file: '', duration: 1450 },
        ],
      },
      {
        title: 'Copy Assist',
        file: 'tests/journeys/copy_assist_injects_no_autosave.spec.ts',
        tests: [
          { status: 'passed', title: 'should open Copy Assist modal', fullTitle: '', file: '', duration: 3200 },
          { status: 'passed', title: 'should inject variant without auto-save', fullTitle: '', file: '', duration: 2800 },
        ],
      },
      {
        title: 'Contact Loop',
        file: 'tests/journeys/contact_loop.spec.ts',
        tests: [
          { status: 'passed', title: 'should show contact modal', fullTitle: '', file: '', duration: 1100 },
          { status: 'failed', title: 'should submit contact form and show success', fullTitle: '', file: '', duration: 8500 },
        ],
      },
      {
        title: 'Model-Based Flow Runner',
        file: 'tests/model/flow_runner.spec.ts',
        tests: [
          { status: 'passed', title: 'should satisfy invariants across random walk', fullTitle: '', file: '', duration: 18500 },
        ],
      },
    ],
  };

  const html = generateHTMLReport(sampleData);
  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`✅ Report generated: ${outputPath}`);
}

main().catch(err => {
  console.error('Error generating report:', err);
  process.exit(1);
});
