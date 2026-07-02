import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "integration",
    environment: "node",
    setupFiles: ["./tests/vitest.setup.ts"],
    include: ["tests/integration/**/*.spec.ts"],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
