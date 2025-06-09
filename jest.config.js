module.exports = {
  testEnvironment: 'node',
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/database.js'
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  verbose: true
};