import Database from 'better-sqlite3';
import config from '../config.js';
import logger from '../logger.js';
import { runMigrations } from './migrations.js';

let db = null;

export function initDatabase() {
  logger.info(`Initializing database at ${config.dbPath}`);
  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  logger.info('Database initialized successfully');
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

export default { initDatabase, getDb, closeDatabase };
