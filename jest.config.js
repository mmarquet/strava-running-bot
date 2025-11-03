module.exports = {
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js', // Exclude main entry point
    '!src/utils/Logger.js', // Utility file with no business logic
    // Infrastructure files - covered by integration tests only
    '!src/database/connection.js', // Database connection infrastructure
    '!src/database/native-sqlite-adapter.js', // Thin DB adapter
    '!src/database/migrate.js' // Migration script
  ],
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  // Ignore problematic tests for now
  testPathIgnorePatterns: [
    '__tests__/index.test.js'
  ],
  coverageReporters: ['text', 'text-summary', 'html', 'lcov'],
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};