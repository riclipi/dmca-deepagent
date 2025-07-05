// Jest setup for WebSocket integration tests
// No window mocking needed for Node environment tests

// Increase timeout for WebSocket tests
jest.setTimeout(10000)

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error for debugging
  error: console.error,
}