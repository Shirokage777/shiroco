import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig keeps JSX for Next.js; tests compile it themselves.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // server-only throws outside the Next.js server; tests run in plain Node.
      "server-only": path.resolve(__dirname, "tests/empty.ts"),
    },
  },
  test: { include: ["tests/**/*.test.ts"] },
});
