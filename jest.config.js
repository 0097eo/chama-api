module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  testTimeout: 10000,
  forceExit: true,
  detectOpenHandles: true,
};