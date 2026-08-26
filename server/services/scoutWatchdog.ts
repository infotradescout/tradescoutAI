import os from "node:os";

export interface HealthMetric {
  metric_name: string;
  current_value: number;
  threshold: number;
  unit: string;
  status: "healthy" | "warning" | "critical";
  timestamp: number;
}

export interface FeatureHealth {
  feature_name: string;
  health_score: number;
  error_rate: number;
  avg_response_time_ms: number;
  requests_per_minute: number;
  status: "healthy" | "degraded" | "down";
  last_error?: string;
  last_error_timestamp?: number;
}

export interface SystemHealthReport {
  report_id: string;
  timestamp: number;
  overall_health_score: number;
  server_metrics: HealthMetric[];
  api_metrics: HealthMetric[];
  database_metrics: HealthMetric[];
  feature_health: FeatureHealth[];
  anomalies_detected: Array<{
    anomaly_type: string;
    severity: "critical" | "high" | "medium" | "low";
    description: string;
    affected_component: string;
  }>;
  coverage: {
    server: { observed: true; source: "node_os" };
    api: { observed: false; reason: string };
    database: { observed: false; reason: string };
    features: { observed: false; reason: string };
  };
  history_scope: "process_local";
  durable: false;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function metricStatus(
  value: number,
  warningThreshold: number,
  criticalThreshold: number
): HealthMetric["status"] {
  if (value >= criticalThreshold) return "critical";
  if (value >= warningThreshold) return "warning";
  return "healthy";
}

export class ScoutWatchdog {
  private healthHistory: SystemHealthReport[] = [];
  private readonly maxHistorySize = 1000;
  private lastReportTime = 0;

  private collectServerMetrics(): HealthMetric[] {
    const timestamp = Date.now();
    const cpuCount = Math.max(os.cpus().length, 1);
    const cpuUsage = clampPercent((os.loadavg()[0] / cpuCount) * 100);
    const totalMemory = os.totalmem();
    const memoryUsage =
      totalMemory > 0
        ? clampPercent((1 - os.freemem() / totalMemory) * 100)
        : 0;

    return [
      {
        metric_name: "cpu_load_1m_per_core",
        current_value: cpuUsage,
        threshold: 85,
        unit: "%",
        status: metricStatus(cpuUsage, 70, 85),
        timestamp,
      },
      {
        metric_name: "memory_usage",
        current_value: memoryUsage,
        threshold: 90,
        unit: "%",
        status: metricStatus(memoryUsage, 80, 90),
        timestamp,
      },
    ];
  }

  private detectServerAnomalies(serverMetrics: HealthMetric[]) {
    return serverMetrics
      .filter((metric) => metric.status !== "healthy")
      .map((metric) => ({
        anomaly_type: metric.metric_name + "_threshold",
        severity: (metric.status === "critical" ? "critical" : "medium") as
          | "critical"
          | "medium",
        description:
          metric.metric_name +
          " is " +
          metric.current_value.toFixed(2) +
          metric.unit,
        affected_component: "Server",
      }));
  }

  async generateHealthReport(): Promise<SystemHealthReport> {
    const timestamp = Date.now();
    const serverMetrics = this.collectServerMetrics();
    const observedMetrics = [...serverMetrics];
    const healthyMetrics = observedMetrics.filter(
      (metric) => metric.status === "healthy"
    ).length;
    const overallHealthScore =
      observedMetrics.length > 0
        ? Math.round((healthyMetrics / observedMetrics.length) * 100)
        : 0;

    const report: SystemHealthReport = {
      report_id: "report_" + timestamp,
      timestamp,
      overall_health_score: overallHealthScore,
      server_metrics: serverMetrics,
      api_metrics: [],
      database_metrics: [],
      feature_health: [],
      anomalies_detected: this.detectServerAnomalies(serverMetrics),
      coverage: {
        server: { observed: true, source: "node_os" },
        api: {
          observed: false,
          reason: "API telemetry source is not configured",
        },
        database: {
          observed: false,
          reason: "database telemetry source is not configured",
        },
        features: {
          observed: false,
          reason: "feature telemetry source is not configured",
        },
      },
      history_scope: "process_local",
      durable: false,
    };

    this.healthHistory.push(report);
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory = this.healthHistory.slice(-this.maxHistorySize);
    }
    this.lastReportTime = timestamp;
    return report;
  }

  getLatestReport(): SystemHealthReport | null {
    return this.healthHistory.length > 0
      ? this.healthHistory[this.healthHistory.length - 1]
      : null;
  }

  getHealthHistory(limit: number = 100): SystemHealthReport[] {
    return this.healthHistory.slice(-limit);
  }

  getCriticalAlerts(): Array<{
    alert_id: string;
    severity: string;
    description: string;
    affected_component: string;
    timestamp: number;
  }> {
    return this.healthHistory
      .flatMap((report) =>
        report.anomalies_detected
          .filter((anomaly) => anomaly.severity === "critical")
          .map((anomaly) => ({
            alert_id: "alert_" + report.report_id + "_" + anomaly.anomaly_type,
            severity: anomaly.severity,
            description: anomaly.description,
            affected_component: anomaly.affected_component,
            timestamp: report.timestamp,
          }))
      )
      .slice(-50);
  }

  getStatistics(): {
    history_scope: "process_local";
    durable: false;
    total_reports: number;
    average_health_score: number;
    critical_alerts_count: number;
    features_monitored: number;
    last_report_timestamp: number;
  } {
    const average =
      this.healthHistory.length > 0
        ? Math.round(
            this.healthHistory.reduce(
              (sum, report) => sum + report.overall_health_score,
              0
            ) / this.healthHistory.length
          )
        : 0;

    return {
      history_scope: "process_local",
      durable: false,
      total_reports: this.healthHistory.length,
      average_health_score: average,
      critical_alerts_count: this.getCriticalAlerts().length,
      features_monitored: 0,
      last_report_timestamp: this.lastReportTime,
    };
  }
}

export default ScoutWatchdog;
