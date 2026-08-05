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
    ...tseslint.configs.strict,
    ...tseslint.configs.stylistic,
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
            // your overrides
            "@typescript-eslint/adjacent-overload-signatures": "error",
            "@typescript-eslint/array-type": [
                "error",
                {
                    "default": "array"
                }
            ],
            "@typescript-eslint/no-empty-object-type": "error",
            "@typescript-eslint/no-unsafe-function-type": "error",
            "@typescript-eslint/no-wrapper-object-types": "error",
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
            "@typescript-eslint/no-unnecessary-type-assertion": "error",
            "@typescript-eslint/dot-notation": "error",
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
            "@typescript-eslint/no-empty-function": "error",
            "@typescript-eslint/no-empty-interface": "off",
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-floating-promises": [
                "warn",
                {
                    "checkThenables": true
                }
            ],
            "@typescript-eslint/unbound-method": "error",
            "@typescript-eslint/no-misused-promises": "error",
            "@typescript-eslint/no-misused-new": "error",
            "@typescript-eslint/no-namespace": "error",
            "@typescript-eslint/no-extraneous-class": "error",
            "@typescript-eslint/no-invalid-void-type": "error",
            "@typescript-eslint/consistent-type-definitions": [
                "error",
                "type"
            ],
            "@typescript-eslint/no-parameter-properties": "off",
            "@typescript-eslint/no-shadow": [
                "error",
                {
                    "hoist": "all"
                }
            ],
            "@typescript-eslint/no-unused-expressions": "error",
            "@typescript-eslint/no-use-before-define": "off",
            "@typescript-eslint/no-require-imports": "error",
            "@typescript-eslint/prefer-for-of": "error",
            "@typescript-eslint/prefer-function-type": "error",
            "@typescript-eslint/prefer-namespace-keyword": "error",
            "@typescript-eslint/restrict-template-expressions": [
                "warn",
                {
                    "allowNumber": true
                }
            ],
            "@typescript-eslint/triple-slash-reference": [
                "error",
                {
                    "path": "always",
                    "types": "prefer-import",
                    "lib": "always"
                }
            ],
            "@typescript-eslint/typedef": "off",
            "@typescript-eslint/unified-signatures": "error",
            "@typescript-eslint/strict-boolean-expressions": "error",
            "@stylistic/indent": ["error", 4],
            "@stylistic/semi": ["error", "always"],
            "@stylistic/comma-dangle": ["error", "always-multiline"],
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
            "constructor-super": "error",
            "dot-notation": "off",
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
            "max-classes-per-file": [
                "error",
                1
            ],
            "no-bitwise": "error",
            "no-caller": "error",
            "no-cond-assign": "error",
            "no-console": "warn",
            "no-debugger": "error",
            "no-empty": "error",
            "no-empty-function": "off",
            "no-eval": "error",
            "no-fallthrough": "off",
            "no-invalid-this": "off",
            "no-new-wrappers": "error",
            "no-shadow": "off",
            "no-throw-literal": "error",
            "no-undef-init": "error",
            "no-underscore-dangle": [
                "error",
                {
                    "allowAfterThis": true
                }
            ],
            "no-unsafe-finally": "error",
            "no-unused-expressions": "error",
            "no-unused-labels": "error",
            "no-use-before-define": "off",
            "no-implicit-coercion": ["error", {
                "boolean": true,
                "number": true,
                "string": true
            }],
            "no-var": "error",
            "object-shorthand": "off",
            "one-var": [
                "error",
                "never"
            ],
            "prefer-const": "error",
            "radix": "error",
            "use-isnan": "error",
            "valid-typeof": "off",
        },
    },
];
