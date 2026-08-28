import { defineConfig } from "vitest/config"
import path from "node:path"

const root = import.meta.dirname

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "services/**/*.test.ts", "apps/web/src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "apps/web/src"),
      "@yums/shared": path.resolve(root, "packages/shared/index.ts"),
      "@yums/event-ingestion": path.resolve(root, "services/event-ingestion/index.ts"),
    },
  },
})
