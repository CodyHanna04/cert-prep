import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/empty.js", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.js", "lib/**/*.test.js"],
    // DB tests share one test database, so run files one at a time.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
