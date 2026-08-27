export type PostgresPublicMediaQueryResult = {
  rows?: Array<Record<string, any>>;
};

export type PostgresPublicMediaS3Client = {
  send(command: unknown): Promise<any>;
  close(): Promise<void>;
};

export function isSafePostgresPublicObjectKey(value: unknown): boolean;
export function publicObjectEtag(body: Buffer | Uint8Array | string): string;
export function resolvePostgresPublicMediaCommandOperation(
  command: unknown
): "PutObject" | "HeadObject" | "GetObject" | null;
export function postgresConditionalStatus(
  input: Record<string, any>,
  object: { ETag?: string; LastModified?: Date }
): 304 | 412 | null;
export function resolvePostgresByteRange(
  value: unknown,
  totalBytes: number
): Readonly<{ start: number; end: number; length: number }> | null;
export function createPostgresPublicMediaS3Client(options: {
  query: (text: string, values?: unknown[]) => Promise<PostgresPublicMediaQueryResult>;
  close?: () => Promise<void>;
}): PostgresPublicMediaS3Client;
