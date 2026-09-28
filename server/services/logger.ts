import { getOperationalRequestContext } from './operationalRequestContext.ts';

// Keep operational context readable without serializing credentials. In particular,
// JSON.stringify(Error) drops the non-enumerable message, stack and cause fields.
const secretFields = new Set([
  'password', 'passwordhash', 'passwordconfirmation', 'currentpassword', 'newpassword',
  'token', 'accesstoken', 'refreshtoken', 'idtoken', 'apikey', 'secretkey', 'clientsecret',
  'secret', 'authorization', 'cookie', 'setcookie', 'sessionid', 'privatekey',
  'databaseurl', 'connectionstring', 'smtppass',
]);

function redactText(value: string): string {
  return value
    .replace(/\bBearer\s+[^\s,"'<>]+/gi, 'Bearer [REDACTED]')
    .replace(/(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@')
    .replace(/\b(password|access_token|refresh_token|api_key|client_secret)=([^\s&"']+)/gi, '$1=[REDACTED]');
}

function logValue(value: unknown, ancestors: Set<object>, depth = 0): unknown {
  if (typeof value === 'string') return redactText(value);
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return '[Function]';
  if (value === null || typeof value !== 'object') return value;
  if (ancestors.has(value)) return '[Circular]';
  if (depth >= 20) return '[Maximum log depth]';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
  if (ArrayBuffer.isView(value)) return { type: 'binary', byteLength: value.byteLength };
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return value.map(item => logValue(item, ancestors, depth + 1));
    const result: Record<string, unknown> = Object.create(null);
    const keys = value instanceof Error
      ? [...new Set(['name', 'message', 'stack', 'cause', 'errors', ...Object.keys(value)])]
      : Object.keys(value);
    for (const key of keys) {
      if (secretFields.has(key.replace(/[^a-z0-9]/gi, '').toLowerCase())) {
        result[key] = '[REDACTED]';
        continue;
      }
      // V8 exposes Error.stack lazily. Read that diagnostic field defensively;
      // arbitrary metadata accessors and toJSON hooks must not execute.
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (value instanceof Error && (key === 'stack' || key === 'name')) {
        try {
          result[key] = logValue(Reflect.get(value, key), ancestors, depth + 1);
        } catch {
          result[key] = '[Error field unavailable]';
        }
      } else if (descriptor && !('value' in descriptor)) {
        result[key] = '[Accessor not evaluated]';
      } else if (descriptor) {
        result[key] = logValue(descriptor.value, ancestors, depth + 1);
      }
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}

function safeStringify(value: unknown): string {
  try {
    const metadata = logValue(value, new Set());
    const requestContext = getOperationalRequestContext();
    if (!requestContext) return JSON.stringify(metadata) ?? '[Undefined]';
    // Preserve existing object fields; caller metadata cannot overwrite our context.
    const fields = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? metadata : value === undefined ? {} : { value: metadata };
    return JSON.stringify({ ...fields, requestContext });
  } catch {
    return '[Unserializable log metadata]';
  }
}

function formatMessage(message: unknown): string {
  try { return redactText(String(message)); } catch { return '[Unserializable log message]'; }
}

function formatMetadata(meta: unknown): string {
  try { return meta !== undefined || getOperationalRequestContext() ? safeStringify(meta) : ''; }
  catch { return '[Request context unavailable]'; }
}

// Preserve the existing human-readable prefixes and severity-specific console sinks.
export const logger = {
  info: (message: string, meta?: unknown) => console.log(`[INFO] ${formatMessage(message)}`, formatMetadata(meta)),
  warn: (message: string, meta?: unknown) => console.warn(`[WARN] ${formatMessage(message)}`, formatMetadata(meta)),
  error: (message: string, meta?: unknown) => console.error(`[ERROR] ${formatMessage(message)}`, formatMetadata(meta)),
  debug: (message: string, meta?: unknown) => console.debug(`[DEBUG] ${formatMessage(message)}`, formatMetadata(meta)),
};
