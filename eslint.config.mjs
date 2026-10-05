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
    // node_modules/** (sin esto, reemplaza el ignore implicito de ESLint en vez de sumarse):
    // invisible hasta que empezaron a existir worktrees de agentes dentro del propio repo
    // (.claude/worktrees/*/node_modules) — sin node_modules ignorado, eslint intentaba lintear
    // las dependencias instaladas ahi mismo.
    "node_modules/**",
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
