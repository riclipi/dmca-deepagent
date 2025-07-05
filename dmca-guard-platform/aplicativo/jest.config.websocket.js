// Separate Jest config for WebSocket integration tests
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.websocket.js'],
  testMatch: [
    '**/__tests__/integration/websocket/**/*.test.ts'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      }
    }]
  },
  testTimeout: 10000,
  collectCoverageFrom: [
    '__tests__/integration/websocket/**/*.ts',
  ],
}