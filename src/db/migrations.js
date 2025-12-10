import logger from '../logger.js';

const migrations = [
  {
    version: 1,
    name: 'initial_schema',
    up: (db) => {
      db.exec(`
        -- Libraries table
        CREATE TABLE IF NOT EXISTS libraries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          path TEXT NOT NULL UNIQUE,
          enabled INTEGER DEFAULT 1,
          watch_enabled INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Exclusions table
        CREATE TABLE IF NOT EXISTS exclusions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          library_id INTEGER,
          pattern TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('folder', 'pattern')),
          reason TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE
        );

        -- Files table
        CREATE TABLE IF NOT EXISTS files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          library_id INTEGER NOT NULL,
          file_path TEXT NOT NULL UNIQUE,
          file_name TEXT NOT NULL,
          original_codec TEXT,
          original_bitrate INTEGER,
          original_size INTEGER,
          original_width INTEGER,
          original_height INTEGER,
          is_hdr INTEGER DEFAULT 0,
          new_size INTEGER,
          status TEXT NOT NULL CHECK (status IN ('queued', 'encoding', 'finished', 'skipped', 'excluded', 'errored', 'rejected')),
          skip_reason TEXT,
          error_message TEXT,
          started_at DATETIME,
          completed_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE
        );

        -- Stats table
        CREATE TABLE IF NOT EXISTS stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date DATE UNIQUE,
          total_files_processed INTEGER DEFAULT 0,
          total_space_saved INTEGER DEFAULT 0,
          files_finished INTEGER DEFAULT 0,
          files_skipped INTEGER DEFAULT 0,
          files_rejected INTEGER DEFAULT 0,
          files_errored INTEGER DEFAULT 0
        );

        -- Encoding log table
        CREATE TABLE IF NOT EXISTS encoding_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_id INTEGER NOT NULL,
          event TEXT NOT NULL,
          details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
        CREATE INDEX IF NOT EXISTS idx_files_library ON files(library_id);
        CREATE INDEX IF NOT EXISTS idx_exclusions_library ON exclusions(library_id);
        CREATE INDEX IF NOT EXISTS idx_encoding_log_file ON encoding_log(file_id);

        -- Schema version table
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY
        );
      `);
    },
  },
];

export function runMigrations(db) {
  // Get current version
  let currentVersion = 0;
  try {
    const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get();
    currentVersion = row?.version || 0;
  } catch (e) {
    // Table doesn't exist yet, that's fine
  }

  // Run pending migrations
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      logger.info(`Running migration ${migration.version}: ${migration.name}`);
      db.transaction(() => {
        migration.up(db);
        db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(migration.version);
      })();
      logger.info(`Migration ${migration.version} completed`);
    }
  }
}

export default { runMigrations };
