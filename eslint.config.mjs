import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Dossiers de travail hors-code (gitignorés, mais la flat config ESLint
    // n'honore pas .gitignore) : artefacts d'incident et sorties du pipeline
    // de tuiles (scripts/render-tiles.mjs).
    ".superpowers/**",
    ".tiles-work/**",
    ".tiles-out/**",
  ]),
]);

export default eslintConfig;
