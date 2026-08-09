import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "type",
    typecheck: {
      enabled: true,
      only: true,
      tsconfig: "tests/type/tsconfig.json",
      include: ["tests/type/**/*.test-d.ts"],
    },
    include: ["tests/type/**/*.test-d.ts"],
  },
});
