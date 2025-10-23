const Database = require('better-sqlite3');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const logger = require('../utils/Logger');
const config = require('../../config/config');
const path = require('path');
const fs = require('fs');

class DatabaseConnection {
  constructor() {
    this.db = null;
    this.drizzle = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      const dbPath = config.database.path || path.join(process.cwd(), 'data', 'data.db');
      logger.info(`Connecting to database at: ${dbPath}`);
      
      this.db = new Database(dbPath);
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');
      
      // Run migrations first
      await this.runMigrations();
      
      this.drizzle = drizzle(this.db);
      this.isInitialized = true;
      logger.info('Database connection established successfully');
      
      return this.drizzle;
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  getDb() {
    if (!this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.drizzle;
  }

  getRawDb() {
    if (!this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  async close() {
    if (this.db) {
      this.db.close();
      this.isInitialized = false;
      logger.info('Database connection closed');
    }
  }

  async runMigrations() {
    try {
      const migrationsDir = path.join(__dirname, 'migrations');
      
      // Check if migrations directory exists
      if (!fs.existsSync(migrationsDir)) {
        logger.info('No migrations directory found, skipping migrations');
        return;
      }

      // Create migration_log table if it doesn't exist
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS migration_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          migration_name TEXT UNIQUE NOT NULL,
          executed_at TEXT DEFAULT CURRENT_TIMESTAMP,
          success INTEGER NOT NULL,
          error_message TEXT,
          data_backup TEXT
        );
      `);

      // Get all SQL migration files
      const files = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

      for (const file of files) {
        const migrationName = path.basename(file, '.sql');
        
        // Check if migration already executed
        const existingMigration = this.db.prepare(
          'SELECT * FROM migration_log WHERE migration_name = ?'
        ).get(migrationName);

        if (existingMigration?.success) {
          logger.info(`Migration ${migrationName} already executed, skipping`);
          continue;
        }

        logger.info(`Running migration: ${migrationName}`);
        
        try {
          const migrationSql = fs.readFileSync(
            path.join(migrationsDir, file), 
            'utf-8'
          );
          
          // Execute migration
          this.db.exec(migrationSql);
          
          // Log successful migration
          this.db.prepare(`
            INSERT OR REPLACE INTO migration_log (migration_name, success) 
            VALUES (?, 1)
          `).run(migrationName);
          
          logger.info(`Migration ${migrationName} completed successfully`);
          
        } catch (error) {
          // Log failed migration
          this.db.prepare(`
            INSERT OR REPLACE INTO migration_log (migration_name, success, error_message) 
            VALUES (?, 0, ?)
          `).run(migrationName, error.message);
          
          logger.error(`Migration ${migrationName} failed:`, error);
          throw error;
        }
      }
      
      logger.info('All migrations completed successfully');
      
    } catch (error) {
      logger.error('Migration failed:', error);
      throw error;
    }
  }
}

const dbConnection = new DatabaseConnection();
module.exports = dbConnection;
