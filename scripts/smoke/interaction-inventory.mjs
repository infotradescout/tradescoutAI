import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const EVENTS = new Set(['onClick', 'onSubmit', 'onChange', 'onKeyDown', 'onDrop', 'onBlur']);

/** Source inventory only: no page load, account creation or passing test is inferred. */
export function inventorySource(filename, sourceText) {
  const ast = ts.createSourceFile(filename, sourceText, ts.ScriptTarget.Latest, true,
    filename.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const sourceSha256 = createHash('sha256').update(sourceText).digest('hex');
  const entries = [];
  const add = (node, kind, name, detail = {}) => {
    const { line } = ast.getLineAndCharacterOfPosition(node.getStart(ast));
    entries.push({ id: `${filename}:${line + 1}:${kind}:${name}`, filename, line: line + 1,
      kind, name, sourceSha256, state: 'not_run', ...detail });
  };
  function visit(node) {
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(ast);
      if (EVENTS.has(name)) add(node, 'ui_event', name, { dynamic: true });
      if (['path', 'href', 'to'].includes(name) && node.initializer) {
        const literal = ts.isStringLiteral(node.initializer) ? node.initializer.text : null;
        if (literal?.startsWith('/')) add(node, 'route_or_link', name, { destination: literal });
      }
    }
    if (ts.isCallExpression(node)) {
      const call = node.expression.getText(ast);
      if (/^(?:test|it)(?:\.(?:skip|fixme|only))?$/.test(call)) {
        const first = node.arguments[0];
        const title = first && ts.isStringLiteralLike(first) ? first.text : '<dynamic title>';
        add(node, 'declared_test', title, { declaredDisposition:
          /\.(skip|fixme)$/.test(call) ? 'disabled' : call.endsWith('.only') ? 'focused_only' : 'enabled',
          dynamic: title === '<dynamic title>' });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  // Duplicate syntactic names on one line still need distinct coverage records.
  const occurrences = new Map();
  for (const entry of entries) {
    const count = (occurrences.get(entry.id) || 0) + 1;
    occurrences.set(entry.id, count);
    entry.id += `:${count}`;
  }
  return entries;
}

export function inventoryRepository(root) {
  const entries = [];
  const scopes = ['client/src', 'tests'];
  for (const scope of scopes) {
    const base = path.join(root, scope);
    if (!fs.existsSync(base)) continue;
    function walk(directory) {
      for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
        if (item.isSymbolicLink()) continue;
        const full = path.join(directory, item.name);
        if (item.isDirectory()) walk(full);
        else if (/\.(?:ts|tsx)$/.test(item.name)) {
          entries.push(...inventorySource(path.relative(root, full).split(path.sep).join('/'), fs.readFileSync(full, 'utf8')));
        }
      }
    }
    walk(base);
  }
  return { contract: 'scout_interaction_inventory.v1', scope: scopes,
    limitation: 'Static declarations only; runtime-generated UI, data permutations and external-service behavior need owned journey adapters.',
    generatedAt: new Date().toISOString(), total: entries.length,
    passed: 0, allPossibleInteractionsCovered: false, entries };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const root = path.resolve(process.argv[2] || '.');
  process.stdout.write(JSON.stringify(inventoryRepository(root), null, 2) + '\n');
}
