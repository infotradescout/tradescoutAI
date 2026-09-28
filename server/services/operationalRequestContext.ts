import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** Operational facts only. Never a copy of request bodies, cookies, or query values. */
export interface OperationalRequestContext {
  requestId: string;
  method: string;
  path: string;
  host: string | null;
  actorId: string | null;
  actorEvidence: 'authenticated_session' | 'unknown';
  agentHint: 'bot' | 'test' | 'unknown';
}

type DiagnosticRequest = IncomingMessage & {
  path?: string;
  originalUrl?: string;
  requestId?: string;
  user?: unknown;
};
type DiagnosticResponse = ServerResponse & { json?: (body?: unknown) => unknown };
type Sink = (message: string, metadata: unknown) => unknown;
export interface DiagnosticLogger { info: Sink; warn: Sink; error: Sink }

const contextStorage = new AsyncLocalStorage<{ context: OperationalRequestContext; request: DiagnosticRequest }>();
const attached = new WeakMap<ServerResponse, { context: OperationalRequestContext; facts: Record<string, unknown> }>();
const identifierFields = ['errorId', 'workRequestId', 'jobId', 'offerId', 'orderId', 'notificationId', 'outboxId', 'providerMessageId'] as const;
const codeFields = ['code', 'reasonCode', 'errorCode'] as const;
const providerIdFields = ['providerMessageId', 'businessNotificationMessageId', 'onboardingEmailMessageId'] as const;
const outcomeFields = ['profileSlug', 'businessStatus', 'providerStatus', 'ownerNotificationStatus', 'businessNotificationEmailStatus', 'businessNotificationEmailReason', 'onboardingEmailStatus', 'onboardingEmailReason'] as const;
const secretSegments = /^(?:reset-password|verify-email|password-reset|access-token|token|magic-link|unsubscribe)$/i;

function own(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}
function token(value: unknown, limit = 160): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= limit && /^[a-zA-Z0-9_.:-]+$/.test(value) ? value : undefined;
}
function safePath(raw: string): string {
  const pathname = raw.split(/[?#]/, 1)[0].slice(0, 1024);
  let hideNext = false;
  return pathname.split('/').map(part => {
    const hide = hideNext;
    hideNext = secretSegments.test(part);
    // Authentication URL tokens and email-address path segments are not operational identifiers.
    return hide || /@|%40|[\r\n\x00-\x1f]/i.test(part) || part.length > 160 ? '[REDACTED]' : part;
  }).join('/');
}
function safeHost(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 253) return null;
  return /^(?:[a-z0-9.-]+|\[[a-f0-9:]+\])(?::\d+)?$/i.test(value) ? value.toLowerCase() : null;
}
function agentHint(value: unknown): OperationalRequestContext['agentHint'] {
  if (typeof value !== 'string') return 'unknown';
  if (/playwright|headlesschrome|tradescout.*(?:proof|smoke|test)/i.test(value)) return 'test';
  if (/googlebot|bingbot|gptbot|chatgpt-user|claudebot|crawler|spider/i.test(value)) return 'bot';
  return 'unknown'; // A browser user-agent is not proof of a human or a customer.
}
function refreshActor(context: OperationalRequestContext, req: DiagnosticRequest): void {
  const id = token(own(req.user, 'id')) ?? token(own(own(req.user, 'claims'), 'sub'));
  context.actorId = id ?? null;
  context.actorEvidence = id ? 'authenticated_session' : 'unknown';
}

/** For shared logger calls made during this request, including asynchronous continuations. */
export function getOperationalRequestContext(): OperationalRequestContext | undefined {
  const current = contextStorage.getStore();
  if (!current) return undefined;
  refreshActor(current.context, current.request);
  return { ...current.context };
}

/** Only trusted server code calls this; header/body fields never establish business outcomes. */
export function recordOperationalOutcome(res: ServerResponse, input: unknown): void {
  const state = attached.get(res);
  if (!state) return;
  try {
    for (const key of [...identifierFields, ...codeFields, ...outcomeFields]) {
      const value = token(own(input, key));
      if (value !== undefined) state.facts[key] = value;
    }
    for (const key of providerIdFields) {
      const value = own(input, key);
      if (typeof value === 'string' && /^[a-zA-Z0-9_.:@<>+/=-]{1,320}$/.test(value)) state.facts[key] = value;
    }
  } catch { /* Logging must not change business behavior. */ }
}

function collectResponseFacts(body: unknown): Record<string, unknown> {
  const facts: Record<string, unknown> = {};
  for (const key of [...identifierFields, ...codeFields]) {
    const value = token(own(body, key));
    if (value !== undefined) facts[key] = value;
  }
  // A response's requestId may identify a saved work request. Keep it distinct
  // from our server-generated correlation ID and never let it overwrite it.
  const responseRequestId = token(own(body, 'requestId'));
  if (responseRequestId) facts.responseRequestId = responseRequestId;
  const success = own(body, 'success');
  if (typeof success === 'boolean') facts.businessSuccess = success;
  const rawIssues = own(body, 'issues') ?? own(body, 'errors');
  if (Array.isArray(rawIssues)) {
    facts.validationIssues = rawIssues.slice(0, 20).map(issue => {
      const rawPath = own(issue, 'path');
      return {
        code: token(own(issue, 'code')) ?? 'unavailable',
        path: Array.isArray(rawPath) ? rawPath.slice(0, 8).map(part => {
          if (typeof part === 'number' && Number.isSafeInteger(part)) return part;
          return token(part, 80) ?? '[REDACTED]';
        }) : [],
      };
    });
    facts.validationIssueCount = rawIssues.length;
  }
  return facts;
}

/** Zod issue codes/field paths only; never validation messages or submitted values. */
export function recordOperationalValidation(res: ServerResponse, issues: unknown): void {
  const state = attached.get(res);
  if (!state) return;
  try { Object.assign(state.facts, collectResponseFacts({ issues })); }
  catch { state.facts.validationDiagnosticsUnavailable = true; }
}

/** Observe an exception without copying its message/body (parser errors can contain submitted secrets). */
export function observeOperationalError(error: unknown, _req: DiagnosticRequest, res: DiagnosticResponse, next: (error?: unknown) => unknown): void {
  try {
    const state = attached.get(res);
    if (state) {
      const code = token(own(error, 'code'));
      const type = token(own(error, 'type'));
      if (code) state.facts.errorCode = code;
      if (type) state.facts.errorType = type;
      state.facts.exceptionObserved = true;
    }
  } catch { /* An invalid diagnostic field must not replace the original error. */ }
  finally { next(error); }
}

/** Attach before redirects, custom-domain handlers, CORS and parsers. No authorization decisions. */
export function createOperationalRequestDiagnostics(logger: DiagnosticLogger) {
  return (req: DiagnosticRequest, res: DiagnosticResponse, next: () => unknown): void => {
    if (attached.has(res)) { next(); return; }
    const started = performance.now();
    const context: OperationalRequestContext = {
      requestId: randomUUID(),
      method: req.method ?? 'UNKNOWN',
      path: safePath(req.originalUrl ?? req.url ?? req.path ?? '/'),
      host: safeHost(req.headers.host),
      actorId: null,
      actorEvidence: 'unknown',
      agentHint: agentHint(req.headers['user-agent']),
    };
    req.requestId = context.requestId;
    res.setHeader('X-Request-Id', context.requestId);
    const state = { context, facts: {} as Record<string, unknown> };
    attached.set(res, state);
    const originalJson = res.json;
    if (originalJson) {
      res.json = function (body?: unknown): unknown {
        try {
          // Replace (not merge) facts if serialization fails and an error response follows.
          state.facts = { ...state.facts, response: collectResponseFacts(body) };
          refreshActor(context, req);
        } catch { state.facts.response = { diagnosticsUnavailable: true }; }
        return originalJson.call(this, body);
      };
    }
    let emitted = false;
    const complete = (aborted: boolean): void => {
      if (emitted) return;
      emitted = true;
      try {
        refreshActor(context, req);
        const statusCode = res.statusCode;
        const length = Number(res.getHeader('content-length'));
        const record = {
          event: 'http_request_completed', ...context,
          buildRevision: /^[a-f0-9]{40}$/i.test(process.env.RENDER_GIT_COMMIT ?? '') ? process.env.RENDER_GIT_COMMIT : null,
          statusCode, durationMs: Math.round((performance.now() - started) * 100) / 100,
          responseBytes: Number.isFinite(length) && length >= 0 ? length : null,
          completion: aborted ? 'aborted' : 'finished',
          probe: ['/api/health', '/api/version'].includes(context.path),
          ...state.facts,
        };
        const sink = statusCode >= 500 ? logger.error : aborted || statusCode >= 400 ? logger.warn : logger.info;
        sink(`[http] ${context.method} ${context.path} ${statusCode} ${record.durationMs}ms`, record);
      } catch { /* Never fail or replay a request because its log sink failed. */ }
    };
    res.once('finish', () => complete(false));
    res.once('close', () => complete(!res.writableFinished));
    contextStorage.run({ context, request: req }, () => { refreshActor(context, req); next(); });
  };
}
