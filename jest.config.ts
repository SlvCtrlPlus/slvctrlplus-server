import type { Config } from 'jest';

const config: Config = {
  preset: "ts-jest",
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    "^.+\\.ts?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
  setupFilesAfterEnv: ['./tests/jest.setup.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.[jt]s$': '$1',
  },
  testEnvironment: "node",
  coverageDirectory: "./build/coverage",
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  },
  "collectCoverageFrom": [
    "src/**/*"
  ]
};

export default config;
