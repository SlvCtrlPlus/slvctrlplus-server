import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/vitest.setup.ts"],
    include: ["tests/integration/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
  },
});
