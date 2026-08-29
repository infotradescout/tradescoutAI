export interface DatabaseUrlSecurityOptions {
  allowInsecureTestConnection?: boolean;
}

export function securePostgresConnectionString(
  value: string | undefined,
  options?: DatabaseUrlSecurityOptions
): string | undefined;

export function secureDatabaseEnvironment<T extends NodeJS.ProcessEnv>(
  environment: T,
  options?: DatabaseUrlSecurityOptions
): T;
