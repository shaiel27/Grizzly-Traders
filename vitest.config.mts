import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    // '**/node_modules/**' (no leading **, antes): solo excluia el node_modules de la raiz, no
    // los anidados — invisible hasta que empezaron a existir worktrees de agentes dentro del
    // propio repo (.claude/worktrees/*/node_modules), cuyos propios tests de dependencias (ej.
    // zod) terminaban corriendo como si fueran parte de este proyecto. '**/' los cubre a todos,
    // a cualquier profundidad, sea cual sea el origen.
    exclude: ['**/node_modules/**', '.next/**', '.claude/worktrees/**'],
  },
})
