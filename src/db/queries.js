import { getDb } from './index.js';

// ============ Libraries ============

export function getAllLibraries() {
  const db = getDb();
  return db.prepare('SELECT * FROM libraries ORDER BY name').all();
}

export function getEnabledLibraries() {
  const db = getDb();
  return db.prepare('SELECT * FROM libraries WHERE enabled = 1 ORDER BY name').all();
}

export function getLibraryById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM libraries WHERE id = ?').get(id);
}

export function createLibrary(name, path) {
  const db = getDb();
  const result = db.prepare('INSERT INTO libraries (name, path) VALUES (?, ?)').run(name, path);
  return result.lastInsertRowid;
}

export function updateLibrary(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (['name', 'path', 'enabled', 'watch_enabled'].includes(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return false;

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const result = db.prepare(`UPDATE libraries SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return result.changes > 0;
}

export function deleteLibrary(id) {
  const db = getDb();
  const result = db.prepare('DELETE FROM libraries WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getLibraryFileCount(libraryId) {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM files WHERE library_id = ?').get(libraryId);
  return row?.count || 0;
}

// ============ Exclusions ============

export function getAllExclusions() {
  const db = getDb();
  return db.prepare(`
    SELECT e.*, l.name as library_name
    FROM exclusions e
    LEFT JOIN libraries l ON e.library_id = l.id
    ORDER BY e.library_id NULLS FIRST, e.pattern
  `).all();
}

export function getExclusionsByLibrary(libraryId) {
  const db = getDb();
  if (libraryId === null) {
    return db.prepare('SELECT * FROM exclusions WHERE library_id IS NULL').all();
  }
  return db.prepare('SELECT * FROM exclusions WHERE library_id = ? OR library_id IS NULL').all(libraryId);
}

export function getGlobalExclusions() {
  const db = getDb();
  return db.prepare('SELECT * FROM exclusions WHERE library_id IS NULL').all();
}

export function createExclusion(libraryId, pattern, type, reason = null) {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO exclusions (library_id, pattern, type, reason) VALUES (?, ?, ?, ?)'
  ).run(libraryId, pattern, type, reason);
  return result.lastInsertRowid;
}

export function updateExclusion(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (['library_id', 'pattern', 'type', 'reason'].includes(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return false;

  values.push(id);

  const result = db.prepare(`UPDATE exclusions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return result.changes > 0;
}

export function deleteExclusion(id) {
  const db = getDb();
  const result = db.prepare('DELETE FROM exclusions WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getExclusionById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM exclusions WHERE id = ?').get(id);
}

// ============ Files ============

export function getFileById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM files WHERE id = ?').get(id);
}

export function getFileByPath(filePath) {
  const db = getDb();
  return db.prepare('SELECT * FROM files WHERE file_path = ?').get(filePath);
}

export function getFiles({ status, libraryId, search, limit = 50, offset = 0 }) {
  const db = getDb();
  let query = 'SELECT f.*, l.name as library_name FROM files f JOIN libraries l ON f.library_id = l.id WHERE 1=1';
  const params = [];

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

  return db.prepare(query).all(...params);
}

export function getFilesCount({ status, libraryId, search }) {
  const db = getDb();
  let query = 'SELECT COUNT(*) as count FROM files WHERE 1=1';
  const params = [];

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

  const row = db.prepare(query).get(...params);
  return row?.count || 0;
}

export function createFile(data) {
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

export function upsertFile(data) {
  const db = getDb();
  // Try to update existing file first
  const existingFile = db.prepare('SELECT id FROM files WHERE file_path = ?').get(data.file_path);

  if (existingFile) {
    // Update the existing file with new data
    const updateFields = [];
    const updateValues = [];

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
    return createFile(data);
  }
}

export function updateFile(id, updates) {
  const db = getDb();
  const allowedFields = [
    'status', 'skip_reason', 'error_message', 'new_size',
    'started_at', 'completed_at', 'original_codec', 'original_bitrate',
    'original_size', 'original_width', 'original_height', 'is_hdr'
  ];

  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return false;

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const result = db.prepare(`UPDATE files SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return result.changes > 0;
}

export function deleteFile(id) {
  const db = getDb();
  const result = db.prepare('DELETE FROM files WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getNextQueuedFile() {
  const db = getDb();
  return db.prepare(`
    SELECT f.*, l.path as library_path
    FROM files f
    JOIN libraries l ON f.library_id = l.id
    WHERE f.status = 'queued'
    ORDER BY f.created_at ASC
    LIMIT 1
  `).get();
}

export function getQueuedFiles({ limit = 100, offset = 0 } = {}) {
  const db = getDb();
  return db.prepare(`
    SELECT f.*, l.name as library_name
    FROM files f
    JOIN libraries l ON f.library_id = l.id
    WHERE f.status = 'queued'
    ORDER BY f.created_at ASC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
}

export function getQueuedFilesCount() {
  const db = getDb();
  const row = db.prepare(`SELECT COUNT(*) as count FROM files WHERE status = 'queued'`).get();
  return row?.count || 0;
}

export function getCurrentEncodingFile() {
  const db = getDb();
  return db.prepare(`
    SELECT f.*, l.name as library_name
    FROM files f
    JOIN libraries l ON f.library_id = l.id
    WHERE f.status = 'encoding'
    LIMIT 1
  `).get();
}

export function resetEncodingFiles() {
  const db = getDb();
  const result = db.prepare(`
    UPDATE files SET status = 'queued', started_at = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE status = 'encoding'
  `).run();
  return result.changes;
}

export function updateFilesStatusByExclusion(pattern, type, libraryId, newStatus) {
  const db = getDb();
  let query;
  const params = [];

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

export function getTodayStats() {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  let row = db.prepare('SELECT * FROM stats WHERE date = ?').get(today);

  if (!row) {
    db.prepare('INSERT INTO stats (date) VALUES (?)').run(today);
    row = db.prepare('SELECT * FROM stats WHERE date = ?').get(today);
  }

  return row;
}

export function updateTodayStats(updates) {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  // Ensure today's row exists
  getTodayStats();

  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (['total_files_processed', 'total_space_saved', 'files_finished', 'files_skipped', 'files_rejected', 'files_errored'].includes(key)) {
      fields.push(`${key} = ${key} + ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return false;

  values.push(today);

  const result = db.prepare(`UPDATE stats SET ${fields.join(', ')} WHERE date = ?`).run(...values);
  return result.changes > 0;
}

export function getStatsHistory(days = 30) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM stats
    ORDER BY date DESC
    LIMIT ?
  `).all(days);
}

export function getOverallStats() {
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
  `).get();

  const spaceSaved = db.prepare(`
    SELECT SUM(original_size - new_size) as total_saved
    FROM files
    WHERE status = 'finished' AND new_size IS NOT NULL
  `).get();

  const totalOriginalSize = db.prepare(`
    SELECT SUM(original_size) as total FROM files WHERE status = 'finished'
  `).get();

  return {
    ...fileCounts,
    total_space_saved: spaceSaved?.total_saved || 0,
    total_original_size: totalOriginalSize?.total || 0,
  };
}

// ============ Encoding Log ============

export function createEncodingLog(fileId, event, details = null) {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO encoding_log (file_id, event, details) VALUES (?, ?, ?)'
  ).run(fileId, event, details ? JSON.stringify(details) : null);
  return result.lastInsertRowid;
}

export function getEncodingLogs(fileId) {
  const db = getDb();
  return db.prepare('SELECT * FROM encoding_log WHERE file_id = ? ORDER BY created_at DESC').all(fileId);
}

export function getRecentActivity(limit = 20) {
  const db = getDb();
  return db.prepare(`
    SELECT f.id, f.file_name, f.status, f.original_size, f.new_size, f.completed_at, l.name as library_name
    FROM files f
    JOIN libraries l ON f.library_id = l.id
    WHERE f.status IN ('finished', 'skipped', 'rejected', 'errored')
    ORDER BY f.completed_at DESC
    LIMIT ?
  `).all(limit);
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
  // Encoding Log
  createEncodingLog,
  getEncodingLogs,
  getRecentActivity,
};
