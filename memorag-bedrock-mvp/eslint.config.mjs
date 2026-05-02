import path from "node:path"
import { fileURLToPath } from "node:url"
import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url))

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/cdk.out/**",
      "infra/cdk.out/**",
      "infra/lambda-dist/**",
      "**/.local-data/**",
      "**/*.map",
      "**/*.log"
    ]
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "apps/web/playwright.config.ts",
            "apps/web/vitest.config.ts",
            "apps/web/e2e/*.ts",
            "infra/test/*.ts"
          ]
        },
        tsconfigRootDir
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports"
        }
      ],
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/no-import-type-side-effects": "error",

      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            attributes: false
          }
        }
      ],
      "@typescript-eslint/await-thenable": "error",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],

      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/require-await": "off",

      "no-console": "off"
    }
  },

  {
    files: [
      "apps/api/src/**/*.ts",
      "infra/**/*.ts",
      "benchmark/**/*.ts",
      "**/*.config.{js,mjs,ts}",
      "**/scripts/**/*.{js,mjs,ts}"
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022
      }
    }
  },

  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022
      }
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/set-state-in-effect": "off",
      "react-refresh/only-export-components": [
        "error",
        {
          allowConstantExport: true
        }
      ]
    }
  },

  {
    files: ["**/*.{test,spec}.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-non-null-assertion": "off"
    }
  }
)
