// Explicit recovery for environments where native esbuild cannot traverse ancestors.
// enhanced-resolve is present in the committed development dependency lockfile.
import fs from 'node:fs';
import path from 'node:path';
import module, { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ResolverFactory, CachedInputFileSystem } = require('enhanced-resolve');
const ts = require('typescript');

export function guardedImport(source, specifier, kind = 'require-call') {
  const tree = ts.createSourceFile('importer.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const matches = [];
  function visit(node) {
    if (ts.isCallExpression(node) && (kind === 'require-call'
      ? ts.isIdentifier(node.expression) && node.expression.text === 'require'
      : node.expression.kind === ts.SyntaxKind.ImportKeyword)
      && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === specifier) {
      // A catching try block only handles a dynamic import rejection when awaited.
      // Naked/returned promises reject after synchronous control leaves the try.
      if (kind === 'dynamic-import' && !ts.isAwaitExpression(node.parent)) {
        matches.push(false);
        ts.forEachChild(node, visit);
        return;
      }
      let child = node;
      let guarded = false;
      for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
        if (ts.isFunctionLike(parent)) break;
        if (ts.isTryStatement(parent) && parent.tryBlock === child && parent.catchClause) guarded = true;
      }
      matches.push(guarded);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return matches.length > 0 && matches.every(Boolean);
}

export function nodeFilesystemPlugin(root, allowedExternals = new Set()) {
  return {
    name: 'node-filesystem',
    setup(build) {
      const resolve = (kind) => ResolverFactory.createResolver({
        fileSystem: new CachedInputFileSystem(fs, 4000),
        useSyncFileSystemCalls: true,
        conditionNames: ['node', kind === 'require-call' || kind === 'require-resolve' ? 'require' : 'import', 'default'],
        mainFields: ['main', 'module'],
        extensions: ['.tsx', '.ts', '.jsx', '.js', '.css', '.json'],
        extensionAlias: { '.js': ['.ts', '.tsx', '.js'], '.mjs': ['.mts', '.mjs'], '.cjs': ['.cts', '.cjs'] },
      });
      const resolvers = new Map();
      const patterns = (build.initialOptions.external || []).map((value) =>
        new RegExp(`^${value.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}(?:/.*)?$`));
      build.onResolve({ filter: /.*/ }, (args) => {
        if (module.isBuiltin(args.path) || patterns.some((pattern) => pattern.test(args.path))) {
          return { path: args.path, external: true };
        }
        let request = args.path;
        if (request.startsWith('@shared/')) request = path.join(root, 'shared', request.slice(8));
        else if (request === '@db') request = path.join(root, 'shared/db.ts');
        else if (request.startsWith('@db/')) request = path.join(root, 'shared', request.slice(4));
        else if (request.startsWith('@/')) request = path.join(root, 'client/src', request.slice(2));
        if (args.kind === 'entry-point') request = path.resolve(root, request);
        if (!resolvers.has(args.kind)) resolvers.set(args.kind, resolve(args.kind));
        let resolved;
        try {
          resolved = resolvers.get(args.kind).resolveSync({}, args.resolveDir || root, request);
        } catch (error) {
          const packageName = args.path.startsWith('@') ? args.path.split('/').slice(0, 2).join('/') : args.path.split('/')[0];
          if (['require-call', 'dynamic-import'].includes(args.kind) && args.importer && allowedExternals.has(packageName)
            && guardedImport(fs.readFileSync(args.importer, 'utf8'), args.path, args.kind)) {
            console.log(`Preserved unresolved guarded ${args.kind}: ${args.path} from ${args.importer}`);
            return { path: args.path, external: true };
          }
          throw error;
        }
        if (!resolved) throw new Error(`Cannot resolve ${args.path} from ${args.resolveDir || root}`);
        return { path: resolved, namespace: 'node-filesystem' };
      });
      build.onLoad({ filter: /.*/, namespace: 'node-filesystem' }, (args) => {
        const extension = path.extname(args.path).slice(1);
        const loader = { mts: 'ts', cts: 'ts', mjs: 'js', cjs: 'js' }[extension] || extension;
        return { contents: fs.readFileSync(args.path), loader, resolveDir: path.dirname(args.path) };
      });
    },
  };
}
