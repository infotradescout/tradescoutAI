import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

await esbuild.build({
  entryPoints: ['server/index.prod.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/index.js',
  external: ['vite', '@vitejs/*', '@replit/*'],
  plugins: [aliasPlugin],
});

console.log('Server bundle built successfully');
