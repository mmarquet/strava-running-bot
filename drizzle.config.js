// Drizzle configuration for SQLite
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/database/schema.js',
  out: './src/database/migrations',
  driver: 'better-sqlite',
  dbCredentials: {
    url: './data/bot.db',
  },
  verbose: true,
  strict: true,
});