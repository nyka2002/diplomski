import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests for pure logic (validation, query/param builders, AI criteria
// mapping). The `@` alias mirrors tsconfig's "@/*": ["./*"]. End-to-end
// behavior is covered separately by tests/smoke.mjs (Playwright).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
