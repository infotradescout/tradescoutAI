interface UIIssue {
  id: string;
  type: 'bug' | 'ux_issue' | 'performance' | 'accessibility' | 'layout';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  element?: string;
  location: string;
  timestamp: Date;
  userAgent: string;
  suggestions: string[];
  status?: 'new' | 'investigating' | 'resolved' | 'ignored';
}

class AIMonitoringService {
  private issues: UIIssue[] = [];
  private isMonitoring = false;
  private observers: MutationObserver[] = [];
  private performanceObserver?: PerformanceObserver;
  private errorListener?: (event: ErrorEvent) => void;
  private unhandledRejectionListener?: (event: PromiseRejectionEvent) => void;
  private checkInterval?: number;
  private lastMemoryReport: number = 0; // Added to track last memory report time

  initializeMonitoring() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.setupErrorHandling();
    this.setupPerformanceMonitoring();
    this.setupAccessibilityChecking();
    this.setupLayoutAnalysis();
    this.setupUXPatternAnalysis();
    this.startPeriodicChecks();
  }

  private setupErrorHandling() {
    // Capture JavaScript errors
    this.errorListener = (event: ErrorEvent) => {
      this.addIssue({
        type: 'bug',
        severity: 'high',
        title: 'JavaScript Error',
        description: `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`,
        location: window.location.pathname,
        userAgent: navigator.userAgent,
        suggestions: [
          'Check the browser console for detailed error information',
          'Verify all required scripts are loaded',
          'Check for undefined variables or functions'
        ]
      });
    };

    // Capture unhandled promise rejections
    this.unhandledRejectionListener = (event: PromiseRejectionEvent) => {
      this.addIssue({
        type: 'bug',
        severity: 'medium',
        title: 'Unhandled Promise Rejection',
        description: event.reason?.toString() || 'Promise rejected without handling',
        location: window.location.pathname,
        userAgent: navigator.userAgent,
        suggestions: [
          'Add proper error handling to async operations',
          'Use try-catch blocks around async code',
          'Check API responses for errors'
        ]
      });
    };

    window.addEventListener('error', this.errorListener);
    window.addEventListener('unhandledrejection', this.unhandledRejectionListener);
  }

  private setupPerformanceMonitoring() {
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();

        entries.forEach(entry => {
          // Check for slow page loads
          if (entry.entryType === 'navigation') {
            const nav = entry as PerformanceNavigationTiming;
            const loadTime = nav.loadEventEnd - nav.navigationStart;

            if (loadTime > 3000) {
              this.addIssue({
                type: 'performance',
                severity: loadTime > 5000 ? 'high' : 'medium',
                title: 'Slow Page Load',
                description: `Page loaded in ${(loadTime / 1000).toFixed(2)}s`,
                location: window.location.pathname,
                userAgent: navigator.userAgent,
                suggestions: [
                  'Optimize image sizes and formats',
                  'Minimize JavaScript and CSS files',
                  'Use lazy loading for below-fold content'
                ]
              });
            }
          }

          // Check for large layout shifts
          if (entry.entryType === 'layout-shift' && (entry as any).value > 0.1) {
            this.addIssue({
              type: 'ux_issue',
              severity: 'medium',
              title: 'Layout Shift Detected',
              description: `Cumulative Layout Shift: ${(entry as any).value.toFixed(3)}`,
              location: window.location.pathname,
              userAgent: navigator.userAgent,
              suggestions: [
                'Set explicit dimensions for images and videos',
                'Reserve space for dynamic content',
                'Use CSS transforms instead of changing layout properties'
              ]
            });
          }

          // Check for long tasks
          if (entry.entryType === 'longtask' && entry.duration > 50) {
            this.addIssue({
              type: 'performance',
              severity: entry.duration > 100 ? 'high' : 'medium',
              title: 'Long JavaScript Task',
              description: `Task blocked main thread for ${entry.duration.toFixed(2)}ms`,
              location: window.location.pathname,
              userAgent: navigator.userAgent,
              suggestions: [
                'Break up long-running JavaScript into smaller chunks',
                'Use Web Workers for heavy computations',
                'Implement code splitting and lazy loading'
              ]
            });
          }
        });
      });

      this.performanceObserver.observe({
        entryTypes: ['navigation', 'layout-shift', 'longtask']
      });
    }
  }

  private setupAccessibilityChecking() {
    const checkAccessibility = () => {
      // Check for missing alt text
      const imagesWithoutAlt = document.querySelectorAll('img:not([alt])');
      if (imagesWithoutAlt.length > 0) {
        this.addIssue({
          type: 'accessibility',
          severity: 'medium',
          title: 'Images Missing Alt Text',
          description: `${imagesWithoutAlt.length} images found without alt attributes`,
          location: window.location.pathname,
          userAgent: navigator.userAgent,
          suggestions: [
            'Add descriptive alt text to all images',
            'Use empty alt="" for decorative images',
            'Consider using ARIA labels for complex images'
          ]
        });
      }

      // Check for form inputs without labels
      const inputsWithoutLabels = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])');
      const unlabeledInputs = Array.from(inputsWithoutLabels).filter(input => {
        const id = input.getAttribute('id');
        return !id || !document.querySelector(`label[for="${id}"]`);
      });

      if (unlabeledInputs.length > 0) {
        this.addIssue({
          type: 'accessibility',
          severity: 'high',
          title: 'Form Inputs Without Labels',
          description: `${unlabeledInputs.length} form inputs found without proper labels`,
          location: window.location.pathname,
          userAgent: navigator.userAgent,
          suggestions: [
            'Associate labels with form inputs using for/id attributes',
            'Use aria-label for inputs without visible labels',
            'Group related inputs with fieldset and legend'
          ]
        });
      }

      // Check color contrast (basic check)
      const elements = document.querySelectorAll('*');
      let lowContrastCount = 0;

      Array.from(elements).slice(0, 50).forEach(el => {
        const styles = window.getComputedStyle(el);
        const bgColor = styles.backgroundColor;
        const textColor = styles.color;

        if (bgColor !== 'rgba(0, 0, 0, 0)' && textColor !== 'rgba(0, 0, 0, 0)') {
          // Basic contrast check (simplified)
          if (this.hasLowContrast(bgColor, textColor)) {
            lowContrastCount++;
          }
        }
      });

      if (lowContrastCount > 5) {
        this.addIssue({
          type: 'accessibility',
          severity: 'medium',
          title: 'Potential Color Contrast Issues',
          description: `${lowContrastCount} elements may have insufficient color contrast`,
          location: window.location.pathname,
          userAgent: navigator.userAgent,
          suggestions: [
            'Test color combinations with WCAG AA standards',
            'Use darker text on light backgrounds',
            'Provide alternative visual cues beyond color'
          ]
        });
      }
    };

    // Run accessibility check after a delay to allow page to render
    setTimeout(checkAccessibility, 2000);
  }

  private hasLowContrast(bgColor: string, textColor: string): boolean {
    // Simplified contrast check - in production, use a proper contrast ratio calculator
    const bgLuminance = this.getColorLuminance(bgColor);
    const textLuminance = this.getColorLuminance(textColor);

    const contrast = (Math.max(bgLuminance, textLuminance) + 0.05) / (Math.min(bgLuminance, textLuminance) + 0.05);
    return contrast < 4.5; // WCAG AA standard for normal text
  }

  private getColorLuminance(color: string): number {
    // Very basic luminance calculation - simplified for demo
    if (color.includes('rgb')) {
      const matches = color.match(/\d+/g);
      if (matches && matches.length >= 3) {
        const [r, g, b] = matches.map(Number);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      }
    }
    return 0.5; // Default middle luminance
  }

  private setupLayoutAnalysis() {
    const checkLayout = () => {
      // Check for horizontal scrolling
      if (document.body.scrollWidth > window.innerWidth) {
        this.addIssue({
          type: 'layout',
          severity: 'medium',
          title: 'Horizontal Scroll Detected',
          description: 'Page content extends beyond viewport width',
          location: window.location.pathname,
          userAgent: navigator.userAgent,
          suggestions: [
            'Check for elements with fixed widths',
            'Use responsive CSS units (%, rem, vw)',
            'Test on various screen sizes'
          ]
        });
      }

      // Check for overlapping elements
      const elements = document.querySelectorAll('*');
      let overlappingCount = 0;

      Array.from(elements).slice(0, 20).forEach((el, index) => {
        const rect1 = el.getBoundingClientRect();
        if (rect1.width === 0 || rect1.height === 0) return;

        Array.from(elements).slice(index + 1, index + 10).forEach(otherEl => {
          const rect2 = otherEl.getBoundingClientRect();
          if (rect2.width === 0 || rect2.height === 0) return;

          if (this.elementsOverlap(rect1, rect2)) {
            overlappingCount++;
          }
        });
      });

      if (overlappingCount > 3) {
        this.addIssue({
          type: 'layout',
          severity: 'low',
          title: 'Potential Element Overlap',
          description: `${overlappingCount} potentially overlapping elements detected`,
          location: window.location.pathname,
          userAgent: navigator.userAgent,
          suggestions: [
            'Check z-index values and positioning',
            'Verify responsive design at different breakpoints',
            'Test layout with longer text content'
          ]
        });
      }
    };

    setTimeout(checkLayout, 1500);
  }

  private elementsOverlap(rect1: DOMRect, rect2: DOMRect): boolean {
    return !(rect1.right < rect2.left ||
             rect2.right < rect1.left ||
             rect1.bottom < rect2.top ||
             rect2.bottom < rect1.top);
  }

  private setupUXPatternAnalysis() {
    let clickCount = 0;
    let frustratedClicks = 0;

    const clickHandler = (event: MouseEvent) => {
      clickCount++;

      // Detect rapid clicks (potential frustration)
      const now = Date.now();
      const recentClicks = this.getRecentClicks(now);

      if (recentClicks.length > 5) {
        frustratedClicks++;

        if (frustratedClicks > 2) {
          this.addIssue({
            type: 'ux_issue',
            severity: 'medium',
            title: 'Potential User Frustration',
            description: 'Multiple rapid clicks detected - user may be having difficulty',
            location: window.location.pathname,
            userAgent: navigator.userAgent,
            element: (event.target as Element)?.tagName,
            suggestions: [
              'Check if buttons provide visual feedback',
              'Ensure interactive elements are clearly clickable',
              'Add loading states for slow operations'
            ]
          });
        }
      }
    };

    document.addEventListener('click', clickHandler);

    // Check for form abandonment patterns
    this.setupFormAnalysis();
  }

  private clickTimes: number[] = [];

  private getRecentClicks(now: number): number[] {
    this.clickTimes.push(now);
    this.clickTimes = this.clickTimes.filter(time => now - time < 3000); // Last 3 seconds
    return this.clickTimes;
  }

  private setupFormAnalysis() {
    const forms = document.querySelectorAll('form');

    forms.forEach(form => {
      let focusEvents = 0;
      let abandonmentCount = 0;

      form.addEventListener('focusin', () => {
        focusEvents++;
      });

      form.addEventListener('focusout', (event) => {
        const target = event.target as HTMLInputElement;
        if (target && target.value.length === 0 && focusEvents > 2) {
          abandonmentCount++;

          if (abandonmentCount > 2) {
            this.addIssue({
              type: 'ux_issue',
              severity: 'medium',
              title: 'Form Abandonment Pattern',
              description: 'Users frequently abandon form fields without input',
              location: window.location.pathname,
              userAgent: navigator.userAgent,
              element: form.tagName,
              suggestions: [
                'Simplify form fields and reduce required information',
                'Add helpful placeholder text and validation',
                'Consider progressive disclosure for complex forms'
              ]
            });
          }
        }
      });
    });
  }

  private startPeriodicChecks() {
    // Monitor every 2 minutes to reduce memory usage
    const MONITORING_INTERVAL = 120000;
    this.checkInterval = window.setInterval(() => {
      this.checkMemoryUsage();
      this.checkLayoutIssues();
      this.checkUXPatterns();
    }, MONITORING_INTERVAL);
  }

  // Placeholder for checkLayoutIssues and checkUXPatterns if they were intended to be separate methods
  private checkLayoutIssues() {
    this.setupLayoutAnalysis();
  }

  private checkUXPatterns() {
    this.setupUXPatternAnalysis();
  }

  private checkMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      if (memory) {
        const heapUsagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

        if (heapUsagePercent > 95) {
          // Only report if usage is critically high and hasn't been reported recently
          const now = Date.now();
          const lastMemoryReport = this.lastMemoryReport || 0;

          if (usagePercent > 95 && (now - lastMemoryReport > 60000)) { // Report max once per minute
            this.lastMemoryReport = now;
            this.addIssue({
              type: 'performance',
              severity: 'high',
              title: 'High Memory Usage',
              description: `JavaScript heap usage at ${(usagePercent).toFixed(1)}%`,
              location: window.location.pathname,
              userAgent: navigator.userAgent,
              suggestions: [
                'Check for memory leaks in event listeners',
                'Clear unused references and intervals',
                'Optimize large data structures'
              ]
            });
          }
        }
      }
    }

    // Send issues to backend if we have any new ones
    if (this.issues.length > 0) {
      this.sendIssuesToBackend();
    }
  }

  private async sendIssuesToBackend() {
    try {
      const response = await fetch('/api/admin/ui-issues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          issues: this.issues.filter(issue => !issue.id) // Only send new issues
        }),
      });

      if (response.ok) {
        // Mark issues as sent
        this.issues.forEach(issue => {
          if (!issue.id) {
            issue.id = `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          }
        });
      }
    } catch (error) {
      console.warn('Failed to send AI monitoring data to backend:', error);
    }
  }

  private addIssue(issueData: Omit<UIIssue, 'id' | 'timestamp'>) {
    const issue: UIIssue = {
      ...issueData,
      id: `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      status: 'new'
    };

    // Avoid duplicate issues with stricter checking
    const existingIssue = this.issues.find(existing =>
      existing.title === issue.title &&
      existing.location === issue.location &&
      Date.now() - existing.timestamp.getTime() < 300000 // Within last 5 minutes
    );

    if (!existingIssue) {
      this.issues.push(issue);

      // More aggressive memory management
      if (this.issues.length > 20) {
        this.issues = this.issues.slice(-10); // Keep only the latest 10 issues
      }

      // Only log critical and high severity issues to reduce noise
      if (issue.severity === 'critical' || issue.severity === 'high') {
        console.warn(`🤖 AI Monitor: ${issue.severity.toUpperCase()} - ${issue.title}`, issue);
      }
    }
  }

  getIssues(): UIIssue[] {
    return [...this.issues];
  }

  clearIssues() {
    this.issues = [];
  }

  destroy() {
    this.isMonitoring = false;

    if (this.errorListener) {
      window.removeEventListener('error', this.errorListener);
    }

    if (this.unhandledRejectionListener) {
      window.removeEventListener('unhandledrejection', this.unhandledRejectionListener);
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

export const aiMonitoringService = new AIMonitoringService();