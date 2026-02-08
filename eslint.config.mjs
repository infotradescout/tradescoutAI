import path from 'node:path';
import typescriptEslintPlugin from '@typescript-eslint/eslint-plugin';
import typescriptEslintParser from '@typescript-eslint/parser';
import eslintConfigPrettier from 'eslint-config-prettier';

const tsconfigPath = path.resolve(process.cwd(), 'tsconfig.lint.json').replace(/\\/g, '/');

export default [
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'client/dist/**',
            'assets/**',
            'client/public/**',
            'legacy/**',
            'components/**',
            'services/**',
            'server/tests/**',
            'scripts/**',
            'tools/**',
            'test-*.ts',
            'set-admin-role.ts',
            '**/tailwind.config.*',
            '**/*.mjs',
            '**/*.js',
            '**/*.cjs',
            'vite.config.ts'
        ]
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: typescriptEslintParser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
                project: tsconfigPath,
                tsconfigRootDir: process.cwd(),
            },
            globals: {
                process: 'readonly',
                console: 'readonly',
                window: 'readonly',
                document: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                module: 'readonly',
                require: 'readonly'
            }
        },
        plugins: {
            '@typescript-eslint': typescriptEslintPlugin,
        },
        rules: {
            ...typescriptEslintPlugin.configs.recommended.rules,
            
            // Ported rules from .eslintrc.cjs
            'no-undef': 'off', // TypeScript handles this
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-non-null-assertion': 'warn',
            
            'no-console': 'off',
            'prefer-const': 'error',
            'no-var': 'error',
            // Allow the common TypeScript pattern `value == null` / `value != null`
            // to check both null and undefined, but enforce strict equality otherwise.
            'eqeqeq': ['error', 'always', { null: 'ignore' }],

            // Guardrails
            'no-restricted-syntax': [
                'warn',
                {
                    selector: "JSXAttribute[name.name='className'] Literal[value=/\\b(bg|text|border)-(navy|slate|gray|blue|orange|red|green)\\b/]",
                    message: 'Use system theme tokens (bg-card, bg-background, text-foreground, etc.).',
                },
                {
                    selector: "JSXAttribute[name.name='style']",
                    message: 'Inline color styles are not allowed. Use theme tokens.',
                },
            ],
        }
    },
    eslintConfigPrettier
];
