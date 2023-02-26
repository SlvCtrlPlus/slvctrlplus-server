import type { Config } from 'jest';

const config: Config = {
  setupFilesAfterEnv: ['./tests/jest.setup.ts'],
  transform: { '\\.[jt]s$': ['ts-jest', { tsconfig: { allowJs: true } }] },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.[jt]s$': '$1',
  },
  testEnvironment: "node",
  coverageDirectory: "./build/coverage",
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 6,
      lines: 14,
      statements: 15
    }
  },
  "collectCoverageFrom": [
    "src/**/*"
  ]
};

export default config;
