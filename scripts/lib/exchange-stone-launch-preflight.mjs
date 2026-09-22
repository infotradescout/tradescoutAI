import { STONE_LAUNCH } from './exchange-stone-launch-package.mjs';
import { securePostgresConnectionString } from '../../shared/database-url-security.mjs';

/** Operator diagnostics only: never emit a URL, password, key, token, query
 * parameter or secret length. This check does not authorize any publication. */
export function inspectStoneLaunchEnvironment(environment = process.env) {
  let target;
  try {
    const secured = securePostgresConnectionString(environment.DATABASE_URL);
    if (secured) target = new URL(secured);
  } catch { /* Report invalid configuration without copying the error/URL. */ }
  const database = target ? decodeURIComponent(target.pathname.slice(1)) : '';
  const checks = {
    productionRuntime: environment.NODE_ENV === 'production',
    expectedService: environment.RENDER_SERVICE_ID === STONE_LAUNCH.serviceId,
    publicationSecretConfigured: typeof environment.SESSION_SECRET === 'string' && environment.SESSION_SECRET.length >= 24,
    metricsSecretConfigured: typeof environment.STONE_METRICS_SECRET === 'string' && environment.STONE_METRICS_SECRET.length >= 24,
    securedDatabaseUrl: Boolean(target),
    expectedDatabaseHost: Boolean(target && STONE_LAUNCH.hosts.includes(target.hostname)),
    expectedDatabaseName: database === STONE_LAUNCH.database,
  };
  return {
    checks, ready: Object.values(checks).every(Boolean),
    // Bounded noncredential identities help reconcile provider configuration.
    observedServiceId: /^srv-[a-z0-9]{1,80}$/.test(environment.RENDER_SERVICE_ID || '') ? environment.RENDER_SERVICE_ID : null,
    observedDatabaseHost: target && /^[a-z0-9.-]{1,253}$/.test(target.hostname) ? target.hostname : null,
    observedDatabaseName: /^[a-zA-Z0-9_]{1,80}$/.test(database) ? database : null,
    databaseConnected: false, publicationAuthorized: false,
  };
}
