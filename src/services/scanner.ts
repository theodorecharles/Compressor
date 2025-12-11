import { readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import config from '../config.js';
import logger from '../logger.js';
import { probeFile } from './ffprobe.js';
import { isExcluded } from './exclusions.js';
import {
  getEnabledLibraries,
  getFileByPath,
  createFile,
  updateTodayStats,
  getEncodingSettings,
} from '../db/queries.js';
import { broadcastScanProgress, broadcastScanComplete } from './websocket.js';
import type { Library, ScanStatus, ScanResult } from '../types/index.js';

// Scan status tracking
const scanStatus: ScanStatus = {
  isScanning: false,
  currentLibrary: null,
  currentLibraryId: null,
  totalFiles: 0,
  processedFiles: 0,
  filesAdded: 0,
  filesSkipped: 0,
  filesErrored: 0,
  currentFile: null,
  lastError: null,
  startedAt: null,
};

// Flag to stop scan
let stopScanRequested = false;

/**
 * Request to stop the current scan
 */
export function stopScan(): boolean {
  if (!scanStatus.isScanning) {
    return false;
  }
  logger.info('Stop scan requested');
  stopScanRequested = true;
  return true;
}

/**
 * Get current scan status
 */
export function getScanStatus(): ScanStatus {
  return { ...scanStatus };
}

/**
 * Scan all enabled libraries for video files
 */
export async function scanAllLibraries(): Promise<{ totalFilesFound: number; totalFilesAdded: number; totalFilesSkipped: number }> {
  if (scanStatus.isScanning) {
    logger.warn('Scan already in progress, skipping');
    return { totalFilesFound: 0, totalFilesAdded: 0, totalFilesSkipped: 0 };
  }

  const libraries = getEnabledLibraries();
  logger.info(`Starting scan of ${libraries.length} libraries`);

  scanStatus.isScanning = true;
  scanStatus.startedAt = new Date().toISOString();

  let totalFilesFound = 0;
  let totalFilesAdded = 0;
  let totalFilesSkipped = 0;

  try {
    for (const library of libraries) {
      const result = await scanLibrary(library);
      totalFilesFound += result.filesFound;
      totalFilesAdded += result.filesAdded;
      totalFilesSkipped += result.filesSkipped;
    }
  } finally {
    // Reset scan status when done
    scanStatus.isScanning = false;
    scanStatus.currentLibrary = null;
    scanStatus.currentLibraryId = null;
    scanStatus.totalFiles = 0;
    scanStatus.processedFiles = 0;
    scanStatus.filesAdded = 0;
    scanStatus.filesSkipped = 0;
    scanStatus.filesErrored = 0;
    scanStatus.currentFile = null;
    scanStatus.lastError = null;
    scanStatus.startedAt = null;

    // Notify clients that scan is complete
    broadcastScanComplete();
  }

  logger.info(`Scan complete: ${totalFilesFound} files found, ${totalFilesAdded} added, ${totalFilesSkipped} skipped`);

  return { totalFilesFound, totalFilesAdded, totalFilesSkipped };
}

/**
 * Scan a single library for video files
 */
export async function scanLibrary(library: Library): Promise<ScanResult> {
  logger.info(`Scanning library: ${library.name} (${library.path})`);

  // Update scan status
  scanStatus.isScanning = true;
  scanStatus.startedAt = new Date().toISOString();
  scanStatus.currentLibrary = library.name;
  scanStatus.currentLibraryId = library.id;
  scanStatus.totalFiles = -1; // -1 indicates "finding files"
  scanStatus.processedFiles = 0;
  scanStatus.filesAdded = 0;
  scanStatus.filesSkipped = 0;
  scanStatus.filesErrored = 0;
  scanStatus.currentFile = null;
  scanStatus.lastError = null;

  // Broadcast immediately so UI shows "finding files" state
  broadcastScanProgress({ ...scanStatus });

  let filesFound = 0;
  let filesAdded = 0;
  let filesSkipped = 0;

  try {
    logger.info(`Finding video files in ${library.path}...`);
    const videoFiles = await findVideoFiles(library.path);
    filesFound = videoFiles.length;
    scanStatus.totalFiles = filesFound;

    logger.info(`Found ${filesFound} video files in ${library.name}`);

    // Broadcast that we found the files
    broadcastScanProgress({ ...scanStatus });

    for (let i = 0; i < videoFiles.length; i++) {
      // Check if stop was requested
      if (stopScanRequested) {
        logger.info(`Scan stopped by user at ${i}/${videoFiles.length} files`);
        stopScanRequested = false;
        break;
      }

      const filePath = videoFiles[i];

      // Update progress
      scanStatus.processedFiles = i;
      scanStatus.currentFile = filePath;

      // Log progress every 1000 files
      if (i > 0 && i % 1000 === 0) {
        logger.info(`Scan progress: ${i}/${videoFiles.length} files processed (${filesAdded} added, ${filesSkipped} skipped)`);
      }

      // Broadcast progress for every file
      broadcastScanProgress({ ...scanStatus });

      try {
        const result = await processFile(filePath, library.id);
        if (result === 'added') {
          filesAdded++;
          scanStatus.filesAdded = filesAdded;
        } else if (result === 'skipped') {
          filesSkipped++;
          scanStatus.filesSkipped = filesSkipped;
        }
      } catch (error) {
        const errorMessage = (error as Error).message;
        logger.error(`Error processing file ${filePath}: ${errorMessage}`);
        scanStatus.filesErrored++;
        scanStatus.lastError = { file: filePath, message: errorMessage };
      }
    }

    // Mark as fully processed
    scanStatus.processedFiles = filesFound;
    broadcastScanProgress({ ...scanStatus });
  } catch (error) {
    logger.error(`Error scanning library ${library.name}: ${(error as Error).message}`);
  }

  // Reset scan status
  scanStatus.isScanning = false;
  scanStatus.currentLibrary = null;
  scanStatus.currentLibraryId = null;
  scanStatus.totalFiles = 0;
  scanStatus.processedFiles = 0;
  scanStatus.filesAdded = 0;
  scanStatus.filesSkipped = 0;
  scanStatus.filesErrored = 0;
  scanStatus.currentFile = null;
  scanStatus.lastError = null;
  scanStatus.startedAt = null;

  // Notify clients that scan is complete
  broadcastScanComplete();

  logger.info(`Library ${library.name} scan complete: ${filesAdded} added, ${filesSkipped} skipped`);

  return { filesFound, filesAdded, filesSkipped };
}

/**
 * Recursively find all video files in a directory
 */
async function findVideoFiles(dir: string, files: string[] = []): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories
        if (!entry.name.startsWith('.')) {
          await findVideoFiles(fullPath, files);
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (config.videoExtensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    logger.warn(`Could not read directory ${dir}: ${(error as Error).message}`);
  }

  return files;
}

/**
 * Process a single file - add to database if not exists
 */
async function processFile(filePath: string, libraryId: number): Promise<'added' | 'skipped' | 'exists'> {
  // Check if file already in database - skip if it exists
  const existingFile = getFileByPath(filePath);
  if (existingFile) {
    return 'exists';
  }

  // Get file stats
  const fileStats = await stat(filePath);
  const fileSize = fileStats.size;
  const fileName = basename(filePath);

  // Check minimum file size using database settings
  const settings = getEncodingSettings();
  const minFileSizeBytes = settings.min_file_size_mb * 1024 * 1024;

  if (fileSize < minFileSizeBytes) {
    createFile({
      library_id: libraryId,
      file_path: filePath,
      file_name: fileName,
      original_codec: null,
      original_bitrate: null,
      original_size: fileSize,
      original_width: null,
      original_height: null,
      is_hdr: false,
      status: 'skipped',
      skip_reason: `File under ${settings.min_file_size_mb}MB minimum`,
    });

    updateTodayStats({ files_skipped: 1 });
    return 'skipped';
  }

  // Check exclusions
  const exclusionCheck = isExcluded(filePath, libraryId);
  if (exclusionCheck.excluded) {
    createFile({
      library_id: libraryId,
      file_path: filePath,
      file_name: fileName,
      original_codec: null,
      original_bitrate: null,
      original_size: fileSize,
      original_width: null,
      original_height: null,
      is_hdr: false,
      status: 'excluded',
      skip_reason: exclusionCheck.reason,
    });

    return 'skipped';
  }

  // Probe file for metadata
  let metadata;
  try {
    metadata = await probeFile(filePath);
  } catch (error) {
    logger.warn(`Could not probe file ${filePath}: ${(error as Error).message}`);
    // Add with error status
    createFile({
      library_id: libraryId,
      file_path: filePath,
      file_name: fileName,
      original_codec: null,
      original_bitrate: null,
      original_size: fileSize,
      original_width: null,
      original_height: null,
      is_hdr: false,
      status: 'errored',
      skip_reason: null,
      error_message: `Failed to probe: ${(error as Error).message}`,
    });

    updateTodayStats({ files_errored: 1 });
    return 'skipped';
  }

  // Check if already HEVC
  if (metadata.isHevc) {
    createFile({
      library_id: libraryId,
      file_path: filePath,
      file_name: fileName,
      original_codec: metadata.codec,
      original_bitrate: metadata.bitrate,
      original_size: fileSize,
      original_width: metadata.width,
      original_height: metadata.height,
      is_hdr: metadata.isHdr,
      status: 'skipped',
      skip_reason: 'Already HEVC',
    });

    updateTodayStats({ files_skipped: 1 });
    return 'skipped';
  }

  // Add to queue
  createFile({
    library_id: libraryId,
    file_path: filePath,
    file_name: fileName,
    original_codec: metadata.codec,
    original_bitrate: metadata.bitrate,
    original_size: fileSize,
    original_width: metadata.width,
    original_height: metadata.height,
    is_hdr: metadata.isHdr,
    status: 'queued',
    skip_reason: null,
  });

  return 'added';
}

/**
 * Process a single new file (for watcher)
 */
export async function processNewFile(filePath: string, libraryId: number): Promise<'added' | 'skipped' | 'exists'> {
  return processFile(filePath, libraryId);
}

export default { scanAllLibraries, scanLibrary, processNewFile, getScanStatus };
