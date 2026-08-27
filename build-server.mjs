import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import module from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'runtime', 'package.json'), 'utf8')
);
const runtimeExternalPackages = new Set([
  ...Object.keys(packageJson.dependencies || {}),
  ...Object.keys(packageJson.optionalDependencies || {}),
  // Optional native/telemetry peers reached by production dependencies.
  '@aws-sdk/signature-v4-crt',
  '@node-rs/xxhash',
  '@opentelemetry/api',
  '@opentelemetry/sdk-metrics',
  'encoding',
  'pg-native',
  'utf-8-validate',
]);

function packageName(specifier) {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
  return specifier.split('/')[0];
}

function externalImports(metafile) {
  return [...new Set(
    Object.values(metafile.outputs)
      .flatMap((output) => output.imports || [])
      .filter((entry) => entry.external)
      .map((entry) => entry.path)
      .filter((specifier) => !module.isBuiltin(specifier))
  )].sort();
}

function assertRuntimeExternals(specifiers) {
  const undeclared = specifiers.filter(
    (specifier) => !runtimeExternalPackages.has(packageName(specifier))
  );
  if (undeclared.length) {
    throw new Error(`Bundled runtime has undeclared external imports: ${undeclared.join(', ')}`);
  }
}

// Plugin to resolve @shared and @db aliases
const aliasPlugin = {
  name: 'alias',
  setup(build) {
    // Resolve @shared/* to ./shared/*.ts
    build.onResolve({ filter: /^@shared\// }, args => {
      const importPath = args.path.replace('@shared/', '');
      const tsPath = path.resolve(__dirname, 'shared', `${importPath}.ts`);
      
      // Check if .ts file exists
      if (fs.existsSync(tsPath)) {
        return { path: tsPath };
      }
      
      // Fallback to directory/index
      return { path: path.resolve(__dirname, 'shared', importPath) };
    });
    
    // Resolve bare @db to ./shared/db.ts
    build.onResolve({ filter: /^@db$/ }, args => {
      return { path: path.resolve(__dirname, 'shared', 'db.ts') };
    });
    
    // Resolve @db/* to ./shared/*.ts
    build.onResolve({ filter: /^@db\// }, args => {
      const importPath = args.path.replace('@db/', '');
      const tsPath = path.resolve(__dirname, 'shared', `${importPath}.ts`);
      
      // Check if .ts file exists
      if (fs.existsSync(tsPath)) {
        return { path: tsPath };
      }
      
      // Fallback to directory/index
      return { path: path.resolve(__dirname, 'shared', importPath) };
    });
  },
};

const serverResult = await esbuild.build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/index.js',
  metafile: true,
  external: [
    'vite', 
    '@vitejs/*', 
    '@replit/*',
    'express',
    'body-parser',
    'cookie-parser',
    'cors',
    'express-session',
    'passport',
    'passport-local',
    'connect-pg-simple',
    'bcrypt',
    'depd',
    'send',
    'mime',
    'etag',
    'fresh',
    'range-parser',
    'node-cron',
    '@google-cloud/vertexai',
    'sharp',
  ],
  plugins: [aliasPlugin],
  banner: {
    js: `
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
`
  }
});

const releaseResult = await esbuild.build({
  entryPoints: {
    'ensure-public-media-ready': 'scripts/ensure-public-media-ready.mjs',
    'migrate-jw-stone-public-media': 'scripts/migrate-jw-stone-public-media.mjs',
    'migrate-red-graniti-public-media': 'scripts/migrate-red-graniti-public-media.mjs',
    'db-migrate-safe': 'scripts/db-migrate-safe.mjs',
    'db-baseline-drizzle': 'scripts/db-baseline-drizzle.mjs',
    'check-required-production-schema': 'scripts/check-required-production-schema.mjs',
    'seed-businesses-places-new': 'scripts/seed_businesses_places_new.mjs',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist/release',
  entryNames: '[name]',
  outExtension: { '.js': '.mjs' },
  metafile: true,
  plugins: [aliasPlugin],
  banner: {
    js: `
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
`,
  },
});

const releaseManifestDirectory = path.join(__dirname, 'dist', 'release', 'manifests');
fs.mkdirSync(releaseManifestDirectory, { recursive: true });
for (const manifestName of [
  'jw-stone-public-media-manifest.json',
  'red-graniti-public-media-manifest.json',
]) {
  fs.copyFileSync(
    path.join(__dirname, 'scripts', 'data', manifestName),
    path.join(releaseManifestDirectory, manifestName)
  );
}

const externals = externalImports({
  outputs: { ...serverResult.metafile.outputs, ...releaseResult.metafile.outputs },
});
assertRuntimeExternals(externals);
fs.writeFileSync(
  'dist/esbuild-metafile.json',
  `${JSON.stringify({ server: serverResult.metafile, release: releaseResult.metafile }, null, 2)}\n`
);
fs.writeFileSync(
  'dist/runtime-externals.json',
  `${JSON.stringify({ version: 1, packages: externals }, null, 2)}\n`
);

console.log(`Server and release bundles built successfully (${externals.length} runtime externals)`);
