import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      './vitest.config.unit.ts',
      './vitest.config.integration.ts',
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "src/**/*.ts",
        "src/**/*.js",
      ],
      thresholds: {
        global: {
          branches: 0,
          functions: 0,
          lines: 0,
          statements: 0,
        },
        perFile: true,
      },
    },
  },
});
