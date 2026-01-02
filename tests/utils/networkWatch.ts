/**
 * Network monitoring and console error capture
 * Logs errors and failed requests for test debugging
 */

import { Page, TestInfo } from '@playwright/test';

export interface NetworkError {
  url: string;
  status: number;
  statusText: string;
  requestMethod: string;
  timestamp: string;
}

export interface ConsoleMessage {
  type: 'log' | 'error' | 'warning' | 'info' | 'debug';
  text: string;
  location: string;
  timestamp: string;
}

export class NetworkWatcher {
  private networkErrors: NetworkError[] = [];
  private consoleMessages: ConsoleMessage[] = [];
  private page: Page;

  constructor(page: Page) {
    this.page = page;
    this.setupListeners();
  }

  private setupListeners(): void {
    // Capture failed network requests
    this.page.on('response', response => {
      if (!response.ok() && response.status() >= 400) {
        this.networkErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          requestMethod: response.request().method(),
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Capture console messages (especially errors)
    this.page.on('console', msg => {
      this.consoleMessages.push({
        type: (msg.type() as any) || 'log',
        text: msg.text(),
        location: msg.location().url || 'unknown',
        timestamp: new Date().toISOString(),
      });
    });

    // Capture uncaught exceptions
    this.page.on('pageerror', error => {
      this.consoleMessages.push({
        type: 'error',
        text: `Uncaught: ${error.message}`,
        location: error.stack || 'unknown',
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Attach collected errors to test info for reporting
   */
  attachToTestInfo(testInfo: TestInfo): void {
    if (this.networkErrors.length > 0) {
      testInfo.attach('network-errors', {
        body: JSON.stringify(this.networkErrors, null, 2),
        contentType: 'application/json',
      });
    }

    if (this.consoleMessages.length > 0) {
      testInfo.attach('console-logs', {
        body: JSON.stringify(this.consoleMessages, null, 2),
        contentType: 'application/json',
      });
    }
  }

  /**
   * Get all network errors that occurred
   */
  getNetworkErrors(): NetworkError[] {
    return [...this.networkErrors];
  }

  /**
   * Get all console messages
   */
  getConsoleMessages(): ConsoleMessage[] {
    return [...this.consoleMessages];
  }

  /**
   * Get only error-level console messages
   */
  getConsoleErrors(): ConsoleMessage[] {
    return this.consoleMessages.filter(m => m.type === 'error');
  }

  /**
   * Check if there were any network failures
   */
  hadNetworkFailures(): boolean {
    return this.networkErrors.length > 0;
  }

  /**
   * Check if there were any console errors
   */
  hadConsoleErrors(): boolean {
    return this.getConsoleErrors().length > 0;
  }

  /**
   * Clear all collected data
   */
  clear(): void {
    this.networkErrors = [];
    this.consoleMessages = [];
  }

  /**
   * Print collected errors to console for debugging
   */
  logErrors(): void {
    if (this.networkErrors.length > 0) {
      console.log('\n🌐 Network Errors:');
      this.networkErrors.forEach(err => {
        console.log(`  ${err.requestMethod} ${err.url} → ${err.status} ${err.statusText}`);
      });
    }

    if (this.getConsoleErrors().length > 0) {
      console.log('\n❌ Console Errors:');
      this.getConsoleErrors().forEach(err => {
        console.log(`  ${err.text} (${err.location})`);
      });
    }
  }
}
