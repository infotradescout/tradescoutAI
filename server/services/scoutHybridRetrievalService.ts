import { createHash } from "node:crypto";
import OpenAI from "openai";

export type ScoutHybridDocumentKind = "provider" | "knowledge";

export type ScoutHybridLocality = {
  countyFips?: string | null;
  state?: string | null;
};

export type ScoutHybridDocument = {
  id: string;
  kind: ScoutHybridDocumentKind;
  title: string;
  body: string;
  sourceUrl?: string | null;
  taxonomy?: string[];
  locality?: ScoutHybridLocality | null;
  authority?: "official" | "first_party" | "reviewed" | "unverified";
  updatedAt?: string | null;
  effectiveFrom?: string | null;
  expiresAt?: string | null;
  supersededAt?: string | null;
};

export type ScoutHybridQuery = {
  text: string;
  kind?: ScoutHybridDocumentKind;
  locality?: ScoutHybridLocality | null;
  strictLocality?: boolean;
  requireCountyMatch?: boolean;
  taxonomy?: string[];
  asOf?: string;
  maxAgeDays?: number;
  requireFreshnessMetadata?: boolean;
  limit?: number;
};

export type ScoutHybridSearchResult = {
  id: string;
  kind: ScoutHybridDocumentKind;
  title: string;
  snippet: string;
  sourceUrl: string | null;
  taxonomy: string[];
  locality: ScoutHybridLocality | null;
  authority: ScoutHybridDocument["authority"];
  chunkId: string;
  score: number;
  bm25Score: number;
  denseScore: number;
};

export type ScoutDenseEmbeddingProvider = {
  readonly provider: string;
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
};

type IndexedChunk = {
  id: string;
  documentId: string;
  title: string;
  text: string;
  tokens: string[];
  embedding: number[];
};

export type ScoutHybridIndexArtifact = {
  schemaVersion: "scout_hybrid_index.v1";
  generatedAt: string;
  embedding: {
    provider: string;
    model: string;
    dimensions: number;
  };
  corpusDigest: string;
  documents: ScoutHybridDocument[];
  chunks: IndexedChunk[];
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "do",
  "does",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "we",
  "what",
  "when",
  "where",
  "which",
  "with",
]);

const TOKEN_EQUIVALENTS: Record<string, string> = {
  ac: "hvac",
  airconditioning: "hvac",
  builder: "build",
  builders: "build",
  building: "build",
  contractor: "provider",
  contractors: "provider",
  electrical: "electric",
  electrician: "electric",
  electricians: "electric",
  fence: "fence",
  fencing: "fence",
  landscaper: "landscape",
  landscaping: "landscape",
  mechanic: "automotive",
  plumber: "plumb",
  plumbers: "plumb",
  plumbing: "plumb",
  roofer: "roof",
  roofers: "roof",
  roofing: "roof",
  video: "video",
  videographer: "video",
};

function cleanToken(value: string): string {
  const compact = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!compact) return "";
  const equivalent = TOKEN_EQUIVALENTS[compact];
  if (equivalent) return equivalent;
  if (compact.length > 5 && compact.endsWith("ies")) return `${compact.slice(0, -3)}y`;
  if (compact.length > 6 && compact.endsWith("ing")) return compact.slice(0, -3);
  if (compact.length > 5 && compact.endsWith("ed")) return compact.slice(0, -2);
  if (compact.length > 4 && compact.endsWith("s")) return compact.slice(0, -1);
  return compact;
}

export function tokenizeScoutHybridText(value: string): string[] {
  return value
    .split(/\s+/)
    .map(cleanToken)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    return vector.map(() => 0);
  }
  return vector.map((value) => value / magnitude);
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function nextRandom(state: number): { state: number; value: number } {
  let next = state || 0x9e3779b9;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return {
    state: next >>> 0,
    value: ((next >>> 0) / 0xffffffff) * 2 - 1,
  };
}

/**
 * Offline-only deterministic dense vectors for unit tests and the controlled
 * benchmark. Production indexes must use a configured semantic embedding
 * provider and record that provider in the artifact.
 */
export class DeterministicDenseEmbeddingProvider implements ScoutDenseEmbeddingProvider {
  readonly provider = "deterministic_offline";
  readonly model = "feature-hash-v1";
  readonly dimensions: number;

  constructor(dimensions = 192) {
    this.dimensions = dimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const vector = Array.from({ length: this.dimensions }, () => 0);
      const tokens = tokenizeScoutHybridText(text);
      for (const token of tokens) {
        let state = fnv1a(token);
        for (let projection = 0; projection < 8; projection += 1) {
          const random = nextRandom(state);
          state = random.state;
          const dimension = state % this.dimensions;
          vector[dimension] += random.value >= 0 ? 1 : -1;
        }
      }
      return normalizeVector(vector);
    });
  }
}

export class OpenAIDenseEmbeddingProvider implements ScoutDenseEmbeddingProvider {
  readonly provider = "openai";
  readonly model: string;
  readonly dimensions: number;
  private readonly client: OpenAI;

  constructor(args: { apiKey: string; model?: string; dimensions?: number }) {
    this.model = args.model || "text-embedding-3-small";
    this.dimensions = args.dimensions || 1_536;
    this.client = new OpenAI({ apiKey: args.apiKey });
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
      dimensions: this.dimensions,
      encoding_format: "float",
    });
    return response.data.map((item) => normalizeVector(item.embedding));
  }
}

function cleanDocument(document: ScoutHybridDocument): ScoutHybridDocument | null {
  const id = String(document.id || "").trim();
  const title = String(document.title || "").trim();
  const body = String(document.body || "").replace(/\s+/g, " ").trim();
  if (!id || !title || !body) return null;
  const sourceUrl = normalizeSourceUrl(document.sourceUrl);
  return {
    ...document,
    id,
    title,
    body,
    sourceUrl,
    taxonomy: Array.from(
      new Set((document.taxonomy || []).map((value) => cleanToken(value)).filter(Boolean))
    ),
    locality: document.locality
      ? {
          countyFips: normalizeCountyFips(document.locality.countyFips),
          state: normalizeState(document.locality.state),
        }
      : null,
  };
}

function normalizeSourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizeCountyFips(value: unknown): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return /^\d{5}$/.test(normalized) ? normalized : null;
}

function normalizeState(value: unknown): string | null {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function chunkDocument(
  document: ScoutHybridDocument,
  chunkWords: number,
  overlapWords: number
): IndexedChunk[] {
  const words = document.body.split(/\s+/).filter(Boolean);
  const stride = Math.max(1, chunkWords - overlapWords);
  const chunks: IndexedChunk[] = [];
  for (let start = 0, ordinal = 0; start < words.length; start += stride, ordinal += 1) {
    const text = words.slice(start, start + chunkWords).join(" ");
    if (!text) continue;
    chunks.push({
      id: `${document.id}#${ordinal}`,
      documentId: document.id,
      title: document.title,
      text,
      tokens: tokenizeScoutHybridText(
        `${document.title} ${(document.taxonomy || []).join(" ")} ${text}`
      ),
      embedding: [],
    });
    if (start + chunkWords >= words.length) break;
  }
  return chunks;
}

function corpusDigest(documents: ScoutHybridDocument[]): string {
  const stable = documents
    .map((document) => ({
      id: document.id,
      kind: document.kind,
      title: document.title,
      body: document.body,
      sourceUrl: document.sourceUrl || null,
      taxonomy: document.taxonomy || [],
      locality: document.locality || null,
      updatedAt: document.updatedAt || null,
      effectiveFrom: document.effectiveFrom || null,
      expiresAt: document.expiresAt || null,
      supersededAt: document.supersededAt || null,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

async function embedInBatches(
  provider: ScoutDenseEmbeddingProvider,
  values: string[],
  batchSize: number
): Promise<number[][]> {
  const output: number[][] = [];
  for (let start = 0; start < values.length; start += batchSize) {
    const batch = values.slice(start, start + batchSize);
    const vectors = await provider.embed(batch);
    if (vectors.length !== batch.length) {
      throw new Error(
        `Embedding provider returned ${vectors.length} vectors for ${batch.length} inputs`
      );
    }
    for (const vector of vectors) {
      if (vector.length !== provider.dimensions) {
        throw new Error(
          `Embedding dimension mismatch: expected ${provider.dimensions}, received ${vector.length}`
        );
      }
      output.push(normalizeVector(vector));
    }
  }
  return output;
}

export async function buildScoutHybridIndex(args: {
  documents: ScoutHybridDocument[];
  embeddingProvider: ScoutDenseEmbeddingProvider;
  chunkWords?: number;
  overlapWords?: number;
  embeddingBatchSize?: number;
}): Promise<ScoutHybridIndexArtifact> {
  const chunkWords = Math.max(80, Math.min(500, args.chunkWords || 220));
  const overlapWords = Math.max(0, Math.min(chunkWords - 1, args.overlapWords || 40));
  const documents = args.documents
    .map(cleanDocument)
    .filter((document): document is ScoutHybridDocument => Boolean(document));
  const ids = new Set<string>();
  for (const document of documents) {
    if (ids.has(document.id)) {
      throw new Error(`Duplicate Scout hybrid document id: ${document.id}`);
    }
    ids.add(document.id);
  }

  const chunks = documents.flatMap((document) =>
    chunkDocument(document, chunkWords, overlapWords)
  );
  const documentsById = new Map(documents.map((document) => [document.id, document]));
  const vectors = await embedInBatches(
    args.embeddingProvider,
    chunks.map(
      (chunk) =>
        `${chunk.title}\n${
          documentsById.get(chunk.documentId)?.taxonomy?.join(" ") || ""
        }\n${chunk.text}`
    ),
    Math.max(1, Math.min(256, args.embeddingBatchSize || 64))
  );
  for (const [index, chunk] of chunks.entries()) {
    chunk.embedding = vectors[index] || [];
  }

  return {
    schemaVersion: "scout_hybrid_index.v1",
    generatedAt: new Date().toISOString(),
    embedding: {
      provider: args.embeddingProvider.provider,
      model: args.embeddingProvider.model,
      dimensions: args.embeddingProvider.dimensions,
    },
    corpusDigest: corpusDigest(documents),
    documents,
    chunks,
  };
}

function parseDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isDocumentEligible(document: ScoutHybridDocument, query: ScoutHybridQuery): boolean {
  if (query.kind && document.kind !== query.kind) return false;

  const asOf = parseDate(query.asOf) ?? Date.now();
  const effectiveFrom = parseDate(document.effectiveFrom);
  const expiresAt = parseDate(document.expiresAt);
  const supersededAt = parseDate(document.supersededAt);
  if (effectiveFrom !== null && effectiveFrom > asOf) return false;
  if (expiresAt !== null && expiresAt < asOf) return false;
  if (supersededAt !== null && supersededAt <= asOf) return false;

  const maxAgeDays =
    typeof query.maxAgeDays === "number" && query.maxAgeDays >= 0 ? query.maxAgeDays : null;
  const updatedAt = parseDate(document.updatedAt);
  if (query.requireFreshnessMetadata && updatedAt === null) return false;
  if (maxAgeDays !== null) {
    if (updatedAt === null && query.requireFreshnessMetadata) return false;
    if (updatedAt !== null && asOf - updatedAt > maxAgeDays * 86_400_000) return false;
  }

  const queryCounty = normalizeCountyFips(query.locality?.countyFips);
  const queryState = normalizeState(query.locality?.state);
  const documentCounty = normalizeCountyFips(document.locality?.countyFips);
  const documentState = normalizeState(document.locality?.state);
  const strictLocality = query.strictLocality ?? Boolean(queryCounty || queryState);

  if (strictLocality) {
    if (queryCounty) {
      if (documentCounty !== queryCounty) return false;
    } else if (queryState && documentState !== queryState) {
      return false;
    }
  }

  if (query.requireCountyMatch && (!queryCounty || documentCounty !== queryCounty)) {
    return false;
  }

  if (query.taxonomy?.length) {
    const required = new Set(query.taxonomy.map(cleanToken).filter(Boolean));
    const available = new Set(document.taxonomy || []);
    if (![...required].some((value) => available.has(value))) return false;
  }

  return true;
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (!left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }
  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator > 0 ? dot / denominator : 0;
}

function termFrequency(tokens: string[]): Map<string, number> {
  const frequencies = new Map<string, number>();
  for (const token of tokens) {
    frequencies.set(token, (frequencies.get(token) || 0) + 1);
  }
  return frequencies;
}

function buildSnippet(text: string, queryTokens: string[]): string {
  const lower = text.toLowerCase();
  const match = queryTokens.find((token) => lower.includes(token));
  if (!match) return text.slice(0, 600);
  const index = lower.indexOf(match);
  const start = Math.max(0, index - 180);
  return text.slice(start, Math.min(text.length, start + 700));
}

export class ScoutHybridSearchIndex {
  private readonly documents = new Map<string, ScoutHybridDocument>();
  private readonly chunks: IndexedChunk[];

  constructor(
    readonly artifact: ScoutHybridIndexArtifact,
    private readonly embeddingProvider: ScoutDenseEmbeddingProvider
  ) {
    if (artifact.schemaVersion !== "scout_hybrid_index.v1") {
      throw new Error(`Unsupported Scout hybrid index schema: ${artifact.schemaVersion}`);
    }
    if (
      artifact.embedding.provider !== embeddingProvider.provider ||
      artifact.embedding.model !== embeddingProvider.model ||
      artifact.embedding.dimensions !== embeddingProvider.dimensions
    ) {
      throw new Error("Scout hybrid index embedding provider does not match its artifact");
    }
    for (const document of artifact.documents) this.documents.set(document.id, document);
    this.chunks = artifact.chunks;
  }

  async search(query: ScoutHybridQuery): Promise<ScoutHybridSearchResult[]> {
    const text = String(query.text || "").trim().slice(0, 12_000);
    if (!text) return [];
    const queryTokens = tokenizeScoutHybridText(text);
    if (!queryTokens.length) return [];

    const eligibleChunks = this.chunks.filter((chunk) => {
      const document = this.documents.get(chunk.documentId);
      return Boolean(document && isDocumentEligible(document, query));
    });
    if (!eligibleChunks.length) return [];

    const documentFrequencies = new Map<string, number>();
    for (const chunk of eligibleChunks) {
      for (const token of new Set(chunk.tokens)) {
        documentFrequencies.set(token, (documentFrequencies.get(token) || 0) + 1);
      }
    }
    const averageLength =
      eligibleChunks.reduce((sum, chunk) => sum + chunk.tokens.length, 0) /
      eligibleChunks.length;
    const k1 = 1.2;
    const b = 0.75;
    const rawBm25 = new Map<string, number>();
    for (const chunk of eligibleChunks) {
      const frequencies = termFrequency(chunk.tokens);
      let score = 0;
      for (const token of queryTokens) {
        const frequency = frequencies.get(token) || 0;
        if (!frequency) continue;
        const documentFrequency = documentFrequencies.get(token) || 0;
        const inverseDocumentFrequency = Math.log(
          1 + (eligibleChunks.length - documentFrequency + 0.5) / (documentFrequency + 0.5)
        );
        const lengthNormalization =
          frequency +
          k1 * (1 - b + b * (chunk.tokens.length / Math.max(1, averageLength)));
        score +=
          inverseDocumentFrequency * ((frequency * (k1 + 1)) / lengthNormalization);
      }
      rawBm25.set(chunk.id, score);
    }

    const [queryEmbedding] = await this.embeddingProvider.embed([text]);
    if (!queryEmbedding || queryEmbedding.length !== this.embeddingProvider.dimensions) {
      throw new Error("Scout hybrid query embedding has an invalid dimension");
    }
    const maxBm25 = Math.max(0, ...rawBm25.values());
    const byDocument = new Map<string, ScoutHybridSearchResult>();
    for (const chunk of eligibleChunks) {
      const document = this.documents.get(chunk.documentId)!;
      const bm25Score = maxBm25 > 0 ? (rawBm25.get(chunk.id) || 0) / maxBm25 : 0;
      const denseScore = Math.max(0, cosineSimilarity(queryEmbedding, chunk.embedding));
      const score = bm25Score * 0.65 + denseScore * 0.35;
      if (score <= 0) continue;
      const result: ScoutHybridSearchResult = {
        id: document.id,
        kind: document.kind,
        title: document.title,
        snippet: buildSnippet(chunk.text, queryTokens),
        sourceUrl: normalizeSourceUrl(document.sourceUrl),
        taxonomy: document.taxonomy || [],
        locality: document.locality || null,
        authority: document.authority || "unverified",
        chunkId: chunk.id,
        score: Number(score.toFixed(8)),
        bm25Score: Number(bm25Score.toFixed(8)),
        denseScore: Number(denseScore.toFixed(8)),
      };
      const current = byDocument.get(document.id);
      if (!current || result.score > current.score) byDocument.set(document.id, result);
    }

    const limit = Math.max(1, Math.min(50, query.limit || 10));
    return [...byDocument.values()]
      .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
      .slice(0, limit);
  }
}

export function createScoutHybridSearchIndex(args: {
  artifact: ScoutHybridIndexArtifact;
  embeddingProvider: ScoutDenseEmbeddingProvider;
}): ScoutHybridSearchIndex {
  return new ScoutHybridSearchIndex(args.artifact, args.embeddingProvider);
}
