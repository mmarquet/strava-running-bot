#!/usr/bin/env node

const databaseManager = require('./DatabaseManager');
const logger = require('../utils/Logger');

async function migrate() {
  try {
    logger.database?.info('Starting database migration...');
    
    await databaseManager.initialize();
    
    logger.database?.info('Database migration completed successfully');
    process.exit(0);
    
  } catch (error) {
    logger.database?.error('Database migration failed', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  void migrate(); // Use void to satisfy SonarQube's preference for not having floating promises
}

module.exports = migrate;
