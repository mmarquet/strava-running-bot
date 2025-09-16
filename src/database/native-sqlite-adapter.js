/**
 * Native SQLite adapter for Node.js 24+ built-in sqlite module
 * Provides a better-sqlite3 compatible interface using node:sqlite
 */

const { DatabaseSync } = require('node:sqlite');

class NativeSQLiteDatabase {
  constructor(path) {
    this.db = new DatabaseSync(path);
  }

  prepare(sql) {
    const stmt = this.db.prepare(sql);
    
    return {
      run: (...params) => {
        const info = stmt.run(...params);
        // Return better-sqlite3 compatible format
        return {
          changes: this.db.totalChanges,
          lastInsertRowid: this.db.lastInsertRowid
        };
      },
      
      get: (...params) => {
        return stmt.get(...params);
      },
      
      all: (...params) => {
        return stmt.all(...params);
      },
      
      finalize: () => {
        // Node.js built-in statements don't need manual finalization
      }
    };
  }

  exec(sql) {
    return this.db.exec(sql);
  }

  close() {
    return this.db.close();
  }

  get inTransaction() {
    return this.db.inTransaction;
  }

  transaction(fn) {
    return this.db.transaction(fn);
  }

  backup(destination, options = {}) {
    return this.db.backup(destination, options);
  }

  // For Drizzle ORM compatibility
  run(query, params = []) {
    const stmt = this.prepare(query.sql || query);
    return stmt.run(...params);
  }

  all(query, params = []) {
    const stmt = this.prepare(query.sql || query);
    return stmt.all(...params);
  }

  get(query, params = []) {
    const stmt = this.prepare(query.sql || query);
    return stmt.get(...params);
  }
}

module.exports = NativeSQLiteDatabase;