import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import eslint from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import preferArrowFunctions from 'eslint-plugin-prefer-arrow-functions';
import globals from 'globals';
import stylistic from '@stylistic/eslint-plugin';
import sortClassMembers from "eslint-plugin-sort-class-members";

export default defineConfig([
    globalIgnores(['**/*.js', '**/*.cjs', '**/*.mjs']),
    {
        files: ['src/**/*.ts'],
        extends: [
            eslint.configs.recommended,
            tseslint.configs.all,
            stylistic.configs.recommended,
            preferArrowFunctions.configs.all,
        ],
        languageOptions: {
            parserOptions: {
                project: './tsconfig.json',
                sourceType: 'module',
            },
            globals: {
                ...globals.node,
            }
        },
        plugins: {
            "@jsdoc": jsdoc,
            "@sortClassMembers": sortClassMembers,
        },
        rules: {
            // Extremely slow (deep readonly type-checking); can hang lint on this codebase.
            "@typescript-eslint/prefer-readonly-parameter-types": "off",
            "@typescript-eslint/no-magic-numbers": ["error", {
                "ignoreReadonlyClassProperties": true,
                "ignoreTypeIndexes": true,
                "ignoreEnums": true,
                "ignoreNumericLiteralTypes": true,
                "ignoreArrayIndexes": true,
                "ignoreDefaultValues": true,
                "ignoreClassFieldInitialValues": true,
                "ignore": [-1, 0, 1, 10],
            }],
            "@typescript-eslint/no-confusing-void-expression": [
                "error",
                {
                    "ignoreArrowShorthand": true,
                }
            ],
            // your overrides
            "@typescript-eslint/array-type": [
                "error",
                {
                    "default": "array"
                }
            ],
            "@typescript-eslint/no-restricted-types": [
                "error",
                {
                    "types": {
                        "Object": "Avoid using the `Object` type. Did you mean `object`?",
                        "Function": "Avoid using the `Function` type. Prefer a specific function type, like `() => void`.",
                        "Boolean": "Avoid using the `Boolean` type. Did you mean `boolean`?",
                        "Number": "Avoid using the `Number` type. Did you mean `number`?",
                        "String": "Avoid using the `String` type. Did you mean `string`?",
                        "Symbol": "Avoid using the `Symbol` type. Did you mean `symbol`?"
                    }
                }
            ],
            "@typescript-eslint/consistent-type-assertions": [
                "error", 
                { 
                    "assertionStyle": "never",
                }
            ],
            "@typescript-eslint/explicit-function-return-type": "error",
            "@typescript-eslint/explicit-member-accessibility": "error",
            "@typescript-eslint/explicit-module-boundary-types": "error",
            "@typescript-eslint/naming-convention": [
                "error",
                {
                    "selector": "classProperty",
                    "modifiers": ["static", "readonly"],
                    "format": ["camelCase", "UPPER_CASE"]
                },
                {
                    "selector": "classProperty",
                    "format": ["camelCase"],
                    "leadingUnderscore": "allow"
                }
            ],
            "@typescript-eslint/no-floating-promises": [
                "warn",
                {
                    "checkThenables": true
                }
            ],
            "@typescript-eslint/consistent-type-definitions": [
                "error",
                "type"
            ],
            "@typescript-eslint/parameter-properties": "error",
            "@typescript-eslint/no-shadow": "error",
            "@typescript-eslint/no-use-before-define": "error",
            "@typescript-eslint/restrict-template-expressions": [
                "warn",
                {
                    "allowNumber": true
                }
            ],
            "@typescript-eslint/strict-boolean-expressions": "error",
            "@typescript-eslint/class-methods-use-this": [
                "error",
                {
                    "ignoreOverrideMethods": true,
                    "ignoreClassesThatImplementAnInterface": true,
                }
            ],
            "@typescript-eslint/max-params": [
                "error",
                {
                    "max": 10
                }
            ],
            "@typescript-eslint/prefer-destructuring": "off",
            "@typescript-eslint/member-ordering": "off",
            "@stylistic/indent": ["error", 4],
            "@stylistic/semi": ["error", "always", { "omitLastInOneLineBlock": true }],
            "@stylistic/brace-style": "off",
            "@stylistic/member-delimiter-style": [
                "error",
                {
                    multiline: {
                        delimiter: "semi",
                        requireLast: true,
                    },
                    singleline: {
                        delimiter: "comma",
                        requireLast: false,
                    },
                },
            ],
            "@stylistic/operator-linebreak": [
                "error",
                "before",
                {
                    overrides: {
                        "=": "after",
                    },
                },
            ],
            "@stylistic/indent-binary-ops": ["error", 4],
            "@stylistic/arrow-parens": ["error", "as-needed"],
            "@stylistic/padding-line-between-statements": ["error", {
                blankLine: "always",
                prev: ["type", "interface", "class", "enum"],
                next: "export",
            }],
            "@jsdoc/check-alignment": "error",
            "@jsdoc/check-indentation": "error",
            "@jsdoc/tag-lines": "error",
            '@sortClassMembers/sort-class-members': ['error', {
                order: [
                    '[public-static-readonly-properties]',
                    '[protected-static-readonly-properties]',
                    '[private-static-readonly-properties]',

                    '[public-static-properties]',
                    '[public-properties]',
                    '[protected-static-properties]',
                    '[protected-properties]',
                    '[private-static-properties]',
                    '[private-properties]',

                    'constructor',

                    '[public-static-methods]',
                    '[public-instance-methods]',
                    '[public-abstract-methods]',

                    '[protected-instance-methods]',
                    '[protected-abstract-methods]',
                    '[protected-static-methods]',
                    
                    '[private-instance-methods]', 
                    '[private-static-methods]', // no private-abstract: TS disallows private abstract members
                ],
                groups: {
                    'public-static-readonly-properties': [
                        { type: 'property', accessibility: 'public', static: true, readonly: true },
                    ],
                    'protected-static-readonly-properties': [
                        { type: 'property', accessibility: 'protected', static: true, readonly: true },
                    ],
                    'private-static-readonly-properties': [
                        { type: 'property', accessibility: 'private', static: true, readonly: true },
                    ],

                    'public-static-properties': [
                        { type: 'property', accessibility: 'public', static: true, readonly: false },
                    ],
                    'protected-static-properties': [
                        { type: 'property', accessibility: 'protected', static: true, readonly: false },
                    ],
                    'private-static-properties': [
                        { type: 'property', accessibility: 'private', static: true, readonly: false },
                    ],

                    'public-properties': [
                        { type: 'property', accessibility: 'public', static: false },
                    ],
                    'protected-properties': [
                        { type: 'property', accessibility: 'protected', static: false },
                    ],
                    'private-properties': [
                        { type: 'property', accessibility: 'private', static: false },
                    ],

                    'public-instance-methods': [
                        { type: 'method', accessibility: 'public', static: false, abstract: false },
                    ],
                    'public-abstract-methods': [
                        { type: 'method', accessibility: 'public', abstract: true },
                    ],
                    'public-static-methods': [
                        { type: 'method', accessibility: 'public', static: true },
                    ],

                    'protected-instance-methods': [
                        { type: 'method', accessibility: 'protected', static: false, abstract: false },
                    ],
                    'protected-abstract-methods': [
                        { type: 'method', accessibility: 'protected', abstract: true },
                    ],
                    'protected-static-methods': [
                        { type: 'method', accessibility: 'protected', static: true },
                    ],

                    'private-instance-methods': [
                        { type: 'method', accessibility: 'private', static: false },
                    ],
                    'private-static-methods': [
                        { type: 'method', accessibility: 'private', static: true },
                    ],
                },
            }],
            "complexity": "error",
            "eqeqeq": [
                "error",
                "smart"
            ],
            "guard-for-in": "error",
            "id-denylist": [
                "error",
                "any",
                "Number",
                "number",
                "String",
                "string",
                "Boolean",
                "boolean",
                "Undefined",
                "undefined"
            ],
            "id-match": "error",
            "max-classes-per-file": "error",
            "no-bitwise": "error",
            "no-caller": "error",
            "no-console": "warn",
            "no-eval": "error",
            "no-fallthrough": "off",
            "no-magic-numbers": "off",
            "no-new-wrappers": "error",
            "no-undef-init": "error",
            "no-underscore-dangle": [
                "error",
                {
                    "allowAfterThis": true
                }
            ],
            "no-implicit-coercion": ["error", {
                "boolean": true,
                "number": true,
                "string": true
            }],
            "one-var": [
                "error",
                "never"
            ],
            "radix": "error",
        },
    },
    {
        files: ['src/**/*.js'],
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'Program',
                    message: 'JavaScript files are not allowed in this project; use TypeScript (.ts) instead.',
                },
            ],
        },
    },
]);
