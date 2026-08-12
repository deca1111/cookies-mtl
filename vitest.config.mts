import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    // Un worktree de Claude Code (.claude/worktrees/<branche>) contient une copie
    // complète du projet, tests inclus. Sans cette exclusion, `npm test` rejoue en
    // double une version périmée de toute la suite : le temps double, un échec
    // là-bas fait échouer le run d'ici, et le compte de tests ne veut plus rien
    // dire. Le filtre par chemin n'en protège pas — `vitest run src` matche aussi
    // `.claude/worktrees/…/src/…`.
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
})
