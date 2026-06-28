import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "unit",
    environment: "node",
    setupFiles: ["./tests/vitest.setup.ts"],
    include: ["tests/unit/**/*.spec.ts"],
  },
});
