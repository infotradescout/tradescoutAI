import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import {
  buildScoutHybridIndex,
  DeterministicDenseEmbeddingProvider,
  OpenAIDenseEmbeddingProvider,
  tokenizeScoutHybridText,
  type ScoutDenseEmbeddingProvider,
  type ScoutHybridDocument,
} from "../server/services/scoutHybridRetrievalService";

type SourceManifestEntry = Partial<
  Pick<
    ScoutHybridDocument,
    | "kind"
    | "sourceUrl"
    | "taxonomy"
    | "locality"
    | "authority"
    | "updatedAt"
    | "effectiveFrom"
    | "expiresAt"
    | "supersededAt"
  >
>;

const ROOT = process.cwd();
const SUPPORTED_EXTENSIONS = new Set([".md", ".txt", ".docx"]);

function cliValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  const value = index >= 0 ? process.argv[index + 1] : null;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function walkFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolutePath));
    else if (SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(absolutePath);
    }
  }
  return files;
}

async function extractText(filePath: string): Promise<string> {
  if (path.extname(filePath).toLowerCase() === ".docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value.replace(/\s+/g, " ").trim();
  }
  return fs.readFileSync(filePath, "utf8").replace(/\s+/g, " ").trim();
}

function readManifest(manifestPath: string): Record<string, SourceManifestEntry> {
  if (!fs.existsSync(manifestPath)) return {};
  const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Scout hybrid source manifest must be an object keyed by relative path");
  }
  return parsed as Record<string, SourceManifestEntry>;
}

function stableDocumentId(relativePath: string): string {
  return `knowledge:${relativePath
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180)}`;
}

function defaultTaxonomy(relativePath: string): string[] {
  return Array.from(
    new Set(
      tokenizeScoutHybridText(relativePath.replace(/\.[^.]+$/, "").replace(/[\\/_.-]+/g, " "))
    )
  ).slice(0, 40);
}

async function loadKnowledgeDocuments(args: {
  rootPath: string;
  manifest: Record<string, SourceManifestEntry>;
}): Promise<ScoutHybridDocument[]> {
  const documents: ScoutHybridDocument[] = [];
  for (const filePath of walkFiles(args.rootPath).sort()) {
    const body = await extractText(filePath);
    if (!body) continue;
    const relativePath = path.relative(ROOT, filePath).split(path.sep).join("/");
    const metadata = args.manifest[relativePath] || {};
    const stats = fs.statSync(filePath);
    documents.push({
      id: stableDocumentId(relativePath),
      kind: metadata.kind || "knowledge",
      title: path.basename(filePath, path.extname(filePath)).replace(/[_-]+/g, " "),
      body,
      sourceUrl: metadata.sourceUrl || null,
      taxonomy: metadata.taxonomy || defaultTaxonomy(relativePath),
      locality: metadata.locality || null,
      // Files are unverified unless a source manifest explicitly records their
      // reviewed authority. A filename or folder location is not provenance.
      authority: metadata.authority || "unverified",
      updatedAt: metadata.updatedAt || stats.mtime.toISOString(),
      effectiveFrom: metadata.effectiveFrom || null,
      expiresAt: metadata.expiresAt || null,
      supersededAt: metadata.supersededAt || null,
    });
  }
  return documents;
}

function loadStructuredDocuments(filePath: string | null): ScoutHybridDocument[] {
  if (!filePath) return [];
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const documents = Array.isArray(parsed)
    ? parsed
    : parsed && Array.isArray(parsed.documents)
      ? parsed.documents
      : null;
  if (!documents) {
    throw new Error("Structured Scout corpus must be an array or an object with documents[]");
  }
  return documents as ScoutHybridDocument[];
}

function createProvider(): ScoutDenseEmbeddingProvider {
  const providerName = cliValue("--provider") || "openai";
  const dimensions = Number(
    cliValue("--dimensions") || (providerName === "deterministic" ? 192 : 1_536)
  );
  if (providerName === "deterministic") {
    if (!hasFlag("--offline-test")) {
      throw new Error("Deterministic embeddings require the explicit --offline-test flag");
    }
    return new DeterministicDenseEmbeddingProvider(Number.isFinite(dimensions) ? dimensions : 192);
  }
  if (providerName !== "openai") {
    throw new Error(`Unsupported embedding provider: ${providerName}`);
  }
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is required to build a production index");
  return new OpenAIDenseEmbeddingProvider({
    apiKey,
    model: cliValue("--model") || "text-embedding-3-small",
    dimensions: Number.isFinite(dimensions) ? dimensions : 1_536,
  });
}

async function run() {
  const knowledgeRoot = path.resolve(
    cliValue("--knowledge-root") || path.join(ROOT, "data", "TradeScout Brain", "40_KNOWLEDGE")
  );
  const manifestPath = path.resolve(
    cliValue("--manifest") || path.join(ROOT, "data", "scout-hybrid-source-manifest.json")
  );
  const structuredPath = cliValue("--structured-corpus");
  const outputPath = path.resolve(
    cliValue("--output") || path.join(ROOT, "data", "scout-hybrid-index.v1.json")
  );
  const manifest = readManifest(manifestPath);
  const documents = [
    ...(await loadKnowledgeDocuments({ rootPath: knowledgeRoot, manifest })),
    ...loadStructuredDocuments(structuredPath ? path.resolve(structuredPath) : null),
  ];
  if (!documents.length) throw new Error("No Scout hybrid documents were found");

  const embeddingProvider = createProvider();
  const artifact = await buildScoutHybridIndex({
    documents,
    embeddingProvider,
    chunkWords: Number(cliValue("--chunk-words") || 220),
    overlapWords: Number(cliValue("--overlap-words") || 40),
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact)}\n`, "utf8");

  const unlinkedDocuments = artifact.documents.filter((document) => !document.sourceUrl).length;
  const unverifiedDocuments = artifact.documents.filter(
    (document) => document.authority === "unverified"
  ).length;
  console.log(
    JSON.stringify(
      {
        outputPath,
        documentCount: artifact.documents.length,
        chunkCount: artifact.chunks.length,
        corpusDigest: artifact.corpusDigest,
        embedding: artifact.embedding,
        unlinkedDocuments,
        unverifiedDocuments,
        cutoverEligible:
          unlinkedDocuments === 0 &&
          unverifiedDocuments === 0 &&
          artifact.embedding.provider !== "deterministic_offline",
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
