import { getDb } from './index.js';
import type {
  Library,
  Exclusion,
  File,
  Stats,
  HourlyStats,
  EncodingLog,
  FileFilters,
  LibraryUpdates,
  ExclusionUpdates,
  FileUpdates,
  StatsUpdates,
  CreateFileData,
  OverallStats,
  QueueSettings,
  QueueSortOrder,
  LibraryPriority,
} from '../types/index.js';

// ============ Libraries ============

export function getAllLibraries(): Library[] {
  const db = getDb();
  return db.prepare('SELECT * FROM libraries ORDER BY name').all() as Library[];
}

export function getEnabledLibraries(): Library[] {
  const db = getDb();
  return db.prepare('SELECT * FROM libraries WHERE enabled = 1 ORDER BY name').all() as Library[];
}

export function getLibraryById(id: number): Library | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM libraries WHERE id = ?').get(id) as Library | undefined;
}

export function createLibrary(name: string, path: string): number | bigint {
  const db = getDb();
  const result = db.prepare('INSERT INTO libraries (name, path) VALUES (?, ?)').run(name, path);
  return result.lastInsertRowid;
}

export function updateLibrary(id: number, updates: LibraryUpdates): boolean {
  const db = getDb();
  const fields: string[] = [];
  const values: (string | number)[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (['name', 'path', 'enabled', 'watch_enabled'].includes(key)) {
      fields.push(`${key} = ?`);
      values.push(value as string | number);
    }
  }

  if (fields.length === 0) return false;

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const result = db.prepare(`UPDATE libraries SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return result.changes > 0;
}

export function deleteLibrary(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM libraries WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getLibraryFileCount(libraryId: number): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM files WHERE library_id = ?').get(libraryId) as { count: number } | undefined;
  return row?.count || 0;
}

// ============ Exclusions ============

export function getAllExclusions(): Exclusion[] {
  const db = getDb();
  return db.prepare(`
    SELECT e.*, l.name as library_name
    FROM exclusions e
    LEFT JOIN libraries l ON e.library_id = l.id
    ORDER BY e.library_id NULLS FIRST, e.pattern
  `).all() as Exclusion[];
}

export function getExclusionsByLibrary(libraryId: number | null): Exclusion[] {
  const db = getDb();
  if (libraryId === null) {
    return db.prepare('SELECT * FROM exclusions WHERE library_id IS NULL').all() as Exclusion[];
  }
  return db.prepare('SELECT * FROM exclusions WHERE library_id = ? OR library_id IS NULL').all(libraryId) as Exclusion[];
}

export function getGlobalExclusions(): Exclusion[] {
  const db = getDb();
  return db.prepare('SELECT * FROM exclusions WHERE library_id IS NULL').all() as Exclusion[];
}

export function createExclusion(libraryId: number | null, pattern: string, type: string, reason: string | null = null): number | bigint {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO exclusions (library_id, pattern, type, reason) VALUES (?, ?, ?, ?)'
  ).run(libraryId, pattern, type, reason);
  return result.lastInsertRowid;
}

export function updateExclusion(id: number, updates: ExclusionUpdates): boolean {
  const db = getDb();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (['library_id', 'pattern', 'type', 'reason'].includes(key)) {
      fields.push(`${key} = ?`);
      values.push(value as string | number | null);
    }
  }

  if (fields.length === 0) return false;

  values.push(id);

  const result = db.prepare(`UPDATE exclusions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return result.changes > 0;
}

export function deleteExclusion(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM exclusions WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getExclusionById(id: number): Exclusion | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM exclusions WHERE id = ?').get(id) as Exclusion | undefined;
}

// ============ Files ============

export function getFileById(id: number): File | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM files WHERE id = ?').get(id) as File | undefined;
}

export function getFileByPath(filePath: string): File | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM files WHERE file_path = ?').get(filePath) as File | undefined;
}

export function getFiles({ status, libraryId, search, limit = 50, offset = 0 }: FileFilters): File[] {
  const db = getDb();
  let query = 'SELECT f.*, l.name as library_name FROM files f JOIN libraries l ON f.library_id = l.id WHERE 1=1';
  const params: (string | number)[] = [];

  if (status) {
    query += ' AND f.status = ?';
    params.push(status);
  }

  if (libraryId) {
    query += ' AND f.library_id = ?';
    params.push(libraryId);
  }

  if (search) {
    query += ' AND f.file_name LIKE ?';
    params.push(`%${search}%`);
  }

  query += ' ORDER BY f.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(query).all(...params) as File[];
}

export function getFilesCount({ status, libraryId, search }: FileFilters): number {
  const db = getDb();
  let query = 'SELECT COUNT(*) as count FROM files WHERE 1=1';
  const params: (string | number)[] = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (libraryId) {
    query += ' AND library_id = ?';
    params.push(libraryId);
  }

  if (search) {
    query += ' AND file_name LIKE ?';
    params.push(`%${search}%`);
  }

  const row = db.prepare(query).get(...params) as { count: number } | undefined;
  return row?.count || 0;
}

export function createFile(data: CreateFileData): number | bigint {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO files (
      library_id, file_path, file_name, original_codec, original_bitrate,
      original_size, original_width, original_height, is_hdr, status, skip_reason, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.library_id,
    data.file_path,
    data.file_name,
    data.original_codec,
    data.original_bitrate,
    data.original_size,
    data.original_width,
    data.original_height,
    data.is_hdr ? 1 : 0,
    data.status,
    data.skip_reason || null,
    data.error_message || null
  );
  return result.lastInsertRowid;
}

export function upsertFile(data: Partial<CreateFileData> & { file_path: string }): number | bigint {
  const db = getDb();
  // Try to update existing file first
  const existingFile = db.prepare('SELECT id FROM files WHERE file_path = ?').get(data.file_path) as { id: number } | undefined;

  if (existingFile) {
    // Update the existing file with new data
    const updateFields: string[] = [];
    const updateValues: (string | number | null)[] = [];

    if (data.library_id !== undefined) { updateFields.push('library_id = ?'); updateValues.push(data.library_id); }
    if (data.file_name !== undefined) { updateFields.push('file_name = ?'); updateValues.push(data.file_name); }
    if (data.original_codec !== undefined) { updateFields.push('original_codec = ?'); updateValues.push(data.original_codec); }
    if (data.original_bitrate !== undefined) { updateFields.push('original_bitrate = ?'); updateValues.push(data.original_bitrate); }
    if (data.original_size !== undefined) { updateFields.push('original_size = ?'); updateValues.push(data.original_size); }
    if (data.original_width !== undefined) { updateFields.push('original_width = ?'); updateValues.push(data.original_width); }
    if (data.original_height !== undefined) { updateFields.push('original_height = ?'); updateValues.push(data.original_height); }
    if (data.is_hdr !== undefined) { updateFields.push('is_hdr = ?'); updateValues.push(data.is_hdr ? 1 : 0); }
    if (data.status !== undefined) { updateFields.push('status = ?'); updateValues.push(data.status); }
    if (data.skip_reason !== undefined) { updateFields.push('skip_reason = ?'); updateValues.push(data.skip_reason); }
    if (data.error_message !== undefined) { updateFields.push('error_message = ?'); updateValues.push(data.error_message); }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(existingFile.id);

    db.prepare(`UPDATE files SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateValues);
    return existingFile.id;
  } else {
    // Insert new file
    return createFile(data as CreateFileData);
  }
}

export function updateFile(id: number, updates: FileUpdates): boolean {
  const db = getDb();
  const allowedFields = [
    'status', 'skip_reason', 'error_message', 'new_size',
    'started_at', 'completed_at', 'original_codec', 'original_bitrate',
    'original_size', 'original_width', 'original_height', 'is_hdr'
  ];

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(value as string | number | null);
    }
  }

  if (fields.length === 0) return false;

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const result = db.prepare(`UPDATE files SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return result.changes > 0;
}

export function deleteFile(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM files WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getNextQueuedFile(): File | undefined {
  const db = getDb();
  const settings = getQueueSettings();

  // Build ORDER BY clause based on settings
  let orderBy = '';

  // Library priority ordering
  if (settings.library_priority === 'round_robin') {
    // For round-robin, we need special handling
    const lastLibraryId = settings.last_library_id;

    // Get all library IDs with queued files, ordered by name
    const librariesWithQueue = db.prepare(`
      SELECT DISTINCT l.id, l.name
      FROM files f
      JOIN libraries l ON f.library_id = l.id
      WHERE f.status = 'queued'
      ORDER BY l.name ASC
    `).all() as { id: number; name: string }[];

    if (librariesWithQueue.length === 0) {
      return undefined;
    }

    // Find the next library in rotation
    let nextLibraryId: number;
    if (lastLibraryId === null) {
      nextLibraryId = librariesWithQueue[0].id;
    } else {
      const lastIndex = librariesWithQueue.findIndex(lib => lib.id === lastLibraryId);
      const nextIndex = (lastIndex + 1) % librariesWithQueue.length;
      nextLibraryId = librariesWithQueue[nextIndex].id;
    }

    // Build file sort order
    let fileSortOrder: string;
    switch (settings.sort_order) {
      case 'bitrate_desc':
        fileSortOrder = 'f.original_bitrate DESC NULLS LAST';
        break;
      case 'bitrate_asc':
        fileSortOrder = 'f.original_bitrate ASC NULLS LAST';
        break;
      case 'alphabetical':
        fileSortOrder = 'f.file_name ASC';
        break;
      case 'random':
        fileSortOrder = 'RANDOM()';
        break;
      default:
        fileSortOrder = 'f.original_bitrate DESC NULLS LAST';
    }

    return db.prepare(`
      SELECT f.*, l.path as library_path
      FROM files f
      JOIN libraries l ON f.library_id = l.id
      WHERE f.status = 'queued' AND f.library_id = ?
      ORDER BY ${fileSortOrder}
      LIMIT 1
    `).get(nextLibraryId) as File | undefined;
  }

  // Non-round-robin: build combined ORDER BY
  const libraryOrder = settings.library_priority === 'alphabetical_desc' ? 'l.name DESC' : 'l.name ASC';

  let fileSortOrder: string;
  switch (settings.sort_order) {
    case 'bitrate_desc':
      fileSortOrder = 'f.original_bitrate DESC NULLS LAST';
      break;
    case 'bitrate_asc':
      fileSortOrder = 'f.original_bitrate ASC NULLS LAST';
      break;
    case 'alphabetical':
      fileSortOrder = 'f.file_name ASC';
      break;
    case 'random':
      fileSortOrder = 'RANDOM()';
      break;
    default:
      fileSortOrder = 'f.original_bitrate DESC NULLS LAST';
  }

  orderBy = `${libraryOrder}, ${fileSortOrder}`;

  return db.prepare(`
    SELECT f.*, l.path as library_path
    FROM files f
    JOIN libraries l ON f.library_id = l.id
    WHERE f.status = 'queued'
    ORDER BY ${orderBy}
    LIMIT 1
  `).get() as File | undefined;
}

export function getQueuedFiles({ limit = 100, offset = 0 } = {}): File[] {
  const db = getDb();
  const settings = getQueueSettings();

  // Build ORDER BY clause based on settings (same as getNextQueuedFile for consistency)
  const libraryOrder = settings.library_priority === 'alphabetical_desc' ? 'l.name DESC' : 'l.name ASC';

  let fileSortOrder: string;
  switch (settings.sort_order) {
    case 'bitrate_desc':
      fileSortOrder = 'f.original_bitrate DESC NULLS LAST';
      break;
    case 'bitrate_asc':
      fileSortOrder = 'f.original_bitrate ASC NULLS LAST';
      break;
    case 'alphabetical':
      fileSortOrder = 'f.file_name ASC';
      break;
    case 'random':
      // For display, use a stable order instead of truly random
      fileSortOrder = 'f.id ASC';
      break;
    default:
      fileSortOrder = 'f.original_bitrate DESC NULLS LAST';
  }

  const orderBy = `${libraryOrder}, ${fileSortOrder}`;

  return db.prepare(`
    SELECT f.*, l.name as library_name
    FROM files f
    JOIN libraries l ON f.library_id = l.id
    WHERE f.status = 'queued'
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(limit, offset) as File[];
}

export function getQueuedFilesCount(): number {
  const db = getDb();
  const row = db.prepare(`SELECT COUNT(*) as count FROM files WHERE status = 'queued'`).get() as { count: number } | undefined;
  return row?.count || 0;
}

export function getCurrentEncodingFile(): File | undefined {
  const db = getDb();
  return db.prepare(`
    SELECT f.*, l.name as library_name
    FROM files f
    JOIN libraries l ON f.library_id = l.id
    WHERE f.status = 'encoding'
    LIMIT 1
  `).get() as File | undefined;
}

export function resetEncodingFiles(): number {
  const db = getDb();
  const result = db.prepare(`
    UPDATE files SET status = 'queued', started_at = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE status = 'encoding'
  `).run();
  return result.changes;
}

/**
 * Remove queued files for a library (when library is disabled)
 */
export function removeQueuedFilesForLibrary(libraryId: number): number {
  const db = getDb();
  const result = db.prepare(`
    DELETE FROM files
    WHERE library_id = ? AND status = 'queued'
  `).run(libraryId);
  return result.changes;
}

export function updateFilesStatusByExclusion(pattern: string, type: string, libraryId: number | null, newStatus: string): number {
  const db = getDb();
  let query: string;
  const params: (string | number)[] = [];

  if (type === 'folder') {
    query = `
      UPDATE files SET status = ?, skip_reason = 'Excluded by folder rule', updated_at = CURRENT_TIMESTAMP
      WHERE file_path LIKE ? AND status = 'queued'
    `;
    params.push(newStatus, pattern + '%');
  } else {
    // For pattern type, we'll handle this in the application layer
    return 0;
  }

  if (libraryId !== null) {
    query = query.replace('WHERE', 'WHERE library_id = ? AND');
    params.splice(1, 0, libraryId);
  }

  const result = db.prepare(query).run(...params);
  return result.changes;
}

// ============ Stats ============

export function getTodayStats(): Stats {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  let row = db.prepare('SELECT * FROM stats WHERE date = ?').get(today) as Stats | undefined;

  if (!row) {
    db.prepare('INSERT INTO stats (date) VALUES (?)').run(today);
    row = db.prepare('SELECT * FROM stats WHERE date = ?').get(today) as Stats;
  }

  return row;
}

export function updateTodayStats(updates: StatsUpdates): boolean {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  // Ensure today's row exists
  getTodayStats();

  const fields: string[] = [];
  const values: (string | number)[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (['total_files_processed', 'total_space_saved', 'files_finished', 'files_skipped', 'files_rejected', 'files_errored'].includes(key)) {
      fields.push(`${key} = ${key} + ?`);
      values.push(value as number);
    }
  }

  if (fields.length === 0) return false;

  values.push(today);

  const result = db.prepare(`UPDATE stats SET ${fields.join(', ')} WHERE date = ?`).run(...values);

  // Also update hourly stats
  updateHourlyStats(updates);

  return result.changes > 0;
}

function getCurrentHourUtc(): string {
  const now = new Date();
  // Format: YYYY-MM-DDTHH:00:00Z
  return now.toISOString().slice(0, 13) + ':00:00Z';
}

export function getHourlyStats(): HourlyStats {
  const db = getDb();
  const hourUtc = getCurrentHourUtc();
  let row = db.prepare('SELECT * FROM stats_hourly WHERE hour_utc = ?').get(hourUtc) as HourlyStats | undefined;

  if (!row) {
    db.prepare('INSERT INTO stats_hourly (hour_utc) VALUES (?)').run(hourUtc);
    row = db.prepare('SELECT * FROM stats_hourly WHERE hour_utc = ?').get(hourUtc) as HourlyStats;
  }

  return row;
}

export function updateHourlyStats(updates: StatsUpdates): boolean {
  const db = getDb();
  const hourUtc = getCurrentHourUtc();

  // Ensure current hour's row exists
  getHourlyStats();

  const fields: string[] = [];
  const values: (string | number)[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (['total_files_processed', 'total_space_saved', 'files_finished', 'files_skipped', 'files_rejected', 'files_errored'].includes(key)) {
      fields.push(`${key} = ${key} + ?`);
      values.push(value as number);
    }
  }

  if (fields.length === 0) return false;

  values.push(hourUtc);

  const result = db.prepare(`UPDATE stats_hourly SET ${fields.join(', ')} WHERE hour_utc = ?`).run(...values);
  return result.changes > 0;
}

export function getHourlyStatsHistory(hours: number = 72): HourlyStats[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM stats_hourly
    ORDER BY hour_utc DESC
    LIMIT ?
  `).all(hours) as HourlyStats[];
}

export function getStatsHistory(days: number = 30): Stats[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM stats
    ORDER BY date DESC
    LIMIT ?
  `).all(days) as Stats[];
}

export function getOverallStats(): OverallStats {
  const db = getDb();

  const fileCounts = db.prepare(`
    SELECT
      COUNT(*) as total_files,
      SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
      SUM(CASE WHEN status = 'encoding' THEN 1 ELSE 0 END) as encoding,
      SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) as finished,
      SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
      SUM(CASE WHEN status = 'excluded' THEN 1 ELSE 0 END) as excluded,
      SUM(CASE WHEN status = 'errored' THEN 1 ELSE 0 END) as errored,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
    FROM files
  `).get() as {
    total_files: number;
    queued: number;
    encoding: number;
    finished: number;
    skipped: number;
    excluded: number;
    errored: number;
    rejected: number;
  };

  const spaceSaved = db.prepare(`
    SELECT SUM(original_size - new_size) as total_saved
    FROM files
    WHERE status = 'finished' AND new_size IS NOT NULL
  `).get() as { total_saved: number | null };

  const totalOriginalSize = db.prepare(`
    SELECT SUM(original_size) as total FROM files WHERE status = 'finished'
  `).get() as { total: number | null };

  return {
    ...fileCounts,
    total_space_saved: spaceSaved?.total_saved || 0,
    total_original_size: totalOriginalSize?.total || 0,
  };
}

// ============ Encoding Log ============

export function createEncodingLog(fileId: number, event: string, details: Record<string, unknown> | null = null): number | bigint {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO encoding_log (file_id, event, details) VALUES (?, ?, ?)'
  ).run(fileId, event, details ? JSON.stringify(details) : null);
  return result.lastInsertRowid;
}

export function getEncodingLogs(fileId: number): EncodingLog[] {
  const db = getDb();
  return db.prepare('SELECT * FROM encoding_log WHERE file_id = ? ORDER BY created_at DESC').all(fileId) as EncodingLog[];
}

interface RecentActivityItem {
  id: number;
  file_name: string;
  status: string;
  original_size: number | null;
  new_size: number | null;
  completed_at: string | null;
  library_name: string;
}

export function getRecentActivity(limit: number = 20): RecentActivityItem[] {
  const db = getDb();
  return db.prepare(`
    SELECT f.id, f.file_name, f.status, f.original_size, f.new_size, f.completed_at, l.name as library_name
    FROM files f
    JOIN libraries l ON f.library_id = l.id
    WHERE f.status IN ('finished', 'skipped', 'rejected', 'errored')
    ORDER BY f.completed_at DESC
    LIMIT ?
  `).all(limit) as RecentActivityItem[];
}

// ============ Settings ============

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function getQueueSettings(): QueueSettings {
  return {
    sort_order: (getSetting('queue_sort_order') || 'bitrate_desc') as QueueSortOrder,
    library_priority: (getSetting('library_priority') || 'alphabetical_asc') as LibraryPriority,
    last_library_id: getSetting('last_library_id') ? parseInt(getSetting('last_library_id')!, 10) : null,
  };
}

export function updateQueueSettings(settings: Partial<QueueSettings>): QueueSettings {
  if (settings.sort_order !== undefined) {
    setSetting('queue_sort_order', settings.sort_order);
  }
  if (settings.library_priority !== undefined) {
    setSetting('library_priority', settings.library_priority);
  }
  if (settings.last_library_id !== undefined) {
    setSetting('last_library_id', settings.last_library_id?.toString() || '');
  }
  return getQueueSettings();
}

export function updateLastLibraryId(libraryId: number | null): void {
  setSetting('last_library_id', libraryId?.toString() || '');
}

export default {
  // Libraries
  getAllLibraries,
  getEnabledLibraries,
  getLibraryById,
  createLibrary,
  updateLibrary,
  deleteLibrary,
  getLibraryFileCount,
  // Exclusions
  getAllExclusions,
  getExclusionsByLibrary,
  getGlobalExclusions,
  createExclusion,
  updateExclusion,
  deleteExclusion,
  getExclusionById,
  // Files
  getFileById,
  getFileByPath,
  getFiles,
  getFilesCount,
  createFile,
  upsertFile,
  updateFile,
  deleteFile,
  getNextQueuedFile,
  getQueuedFiles,
  getQueuedFilesCount,
  getCurrentEncodingFile,
  resetEncodingFiles,
  updateFilesStatusByExclusion,
  // Stats
  getTodayStats,
  updateTodayStats,
  getStatsHistory,
  getOverallStats,
  getHourlyStats,
  updateHourlyStats,
  getHourlyStatsHistory,
  // Encoding Log
  createEncodingLog,
  getEncodingLogs,
  getRecentActivity,
  // Settings
  getSetting,
  setSetting,
  getQueueSettings,
  updateQueueSettings,
  updateLastLibraryId,
};
