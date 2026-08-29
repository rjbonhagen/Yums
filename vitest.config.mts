import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "node:path"

const root = import.meta.dirname

export default defineConfig({
  plugins: [react()],
  test: {
    include: [
      "packages/**/*.test.ts",
      "services/**/*.test.ts",
      "apps/web/src/**/*.test.ts",
      "apps/web/src/**/*.test.tsx",
    ],
    exclude: ["**/node_modules/**", "**/.next/**"],
    // jsdom is required for the .test.tsx component tests; the plain-logic
    // .test.ts files (scoring, geo, event mapping) don't touch the DOM but
    // run fine under it too, so one environment for everything is simplest.
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "apps/web/src"),
      "@yums/shared": path.resolve(root, "packages/shared/index.ts"),
      "@yums/event-ingestion": path.resolve(root, "services/event-ingestion/index.ts"),
    },
  },
})
