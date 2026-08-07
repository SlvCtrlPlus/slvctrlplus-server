import tseslint from "typescript-eslint";
import eslint from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import preferArrowFunctions from "eslint-plugin-prefer-arrow-functions";
import globals from 'globals';
import stylistic from "@stylistic/eslint-plugin";

export default [
    {
        ignores: [
            'node_modules',
            'dist',
            'coverage',
            'tests',
            'vitest.config.ts',
            'vitest.config.unit.ts',
            'vitest.config.integration.ts',
            'eslint.config.ts',
        ],
    },
    eslint.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    stylistic.configs.recommended,
    preferArrowFunctions.configs.all,
    {
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
        },
        rules: {
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
            "@typescript-eslint/explicit-member-accessibility": [
                "error",
                {
                    "accessibility": "explicit"
                }
            ],
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
            "@stylistic/indent": ["error", 4],
            "@stylistic/semi": ["error", "always"],
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
            "no-new-wrappers": "error",
            "no-throw-literal": "error",
            "no-undef-init": "error",
            "no-underscore-dangle": [
                "error",
                {
                    "allowAfterThis": true
                }
            ],
            "no-unused-expressions": "error",
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
            "valid-typeof": "off",
        },
    },
];
