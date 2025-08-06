module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  projects: [
    {
      displayName: 'shared',
      testMatch: ['<rootDir>/packages/shared/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
    },
    {
      displayName: 'api',
      testMatch: ['<rootDir>/apps/api/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
    },
    {
      displayName: 'web',
      testMatch: ['<rootDir>/apps/web/**/*.test.{ts,tsx}'],
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/apps/web/src/setupTests.ts'],
      moduleNameMapping: {
        '^@/(.*)$': '<rootDir>/apps/web/src/$1',
        '^@shared/(.*)$': '<rootDir>/packages/shared/src/$1',
      },
    },
    {
      displayName: 'mobile',
      testMatch: ['<rootDir>/apps/mobile/**/*.test.{ts,tsx}'],
      preset: 'react-native',
      setupFilesAfterEnv: ['<rootDir>/apps/mobile/src/setupTests.ts'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
      transformIgnorePatterns: [
        'node_modules/(?!(react-native|@react-native|@react-navigation)/)',
      ],
    },
  ],
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/coverage/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};