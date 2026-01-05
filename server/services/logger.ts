const safeStringify = (obj: any) => {
  try {
    return JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
  } catch (error) {
    return '[Circular or Invalid JSON]';
  }
};

export const logger = {
  info: (message: string, meta?: any) => console.log(`[INFO] ${message}`, meta ? safeStringify(meta) : ''),
  warn: (message: string, meta?: any) => console.warn(`[WARN] ${message}`, meta ? safeStringify(meta) : ''),
  error: (message: string, meta?: any) => console.error(`[ERROR] ${message}`, meta ? safeStringify(meta) : ''),
  debug: (message: string, meta?: any) => console.debug(`[DEBUG] ${message}`, meta ? safeStringify(meta) : ''),
};
