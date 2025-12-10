import chokidar from 'chokidar';
import { extname } from 'path';
import config from '../config.js';
import logger from '../logger.js';
import { processNewFile } from './scanner.js';
import { getEnabledLibraries } from '../db/queries.js';

const watchers = new Map();

/**
 * Start watching all enabled libraries with watch_enabled = true
 */
export function startWatching() {
  const libraries = getEnabledLibraries().filter(lib => lib.watch_enabled);

  logger.info(`Starting file watchers for ${libraries.length} libraries`);

  for (const library of libraries) {
    startWatchingLibrary(library);
  }
}

/**
 * Start watching a single library
 */
export function startWatchingLibrary(library) {
  if (watchers.has(library.id)) {
    logger.warn(`Watcher already exists for library ${library.name}`);
    return;
  }

  logger.info(`Starting watcher for library: ${library.name} (${library.path})`);

  const watcher = chokidar.watch(library.path, {
    ignored: /(^|[\/\\])\../, // Ignore dotfiles
    persistent: true,
    ignoreInitial: true, // Don't fire for existing files
    awaitWriteFinish: {
      stabilityThreshold: 5000, // Wait 5 seconds for file to finish writing
      pollInterval: 1000,
    },
    depth: 99, // Watch subdirectories
  });

  watcher.on('add', async (filePath) => {
    const ext = extname(filePath).toLowerCase();

    if (!config.videoExtensions.includes(ext)) {
      return;
    }

    logger.info(`New file detected: ${filePath}`);

    try {
      const result = await processNewFile(filePath, library.id);
      logger.info(`New file processed: ${filePath} - ${result}`);
    } catch (error) {
      logger.error(`Error processing new file ${filePath}: ${error.message}`);
    }
  });

  watcher.on('error', (error) => {
    logger.error(`Watcher error for library ${library.name}: ${error.message}`);
  });

  watchers.set(library.id, watcher);
}

/**
 * Stop watching a library
 */
export async function stopWatchingLibrary(libraryId) {
  const watcher = watchers.get(libraryId);

  if (watcher) {
    await watcher.close();
    watchers.delete(libraryId);
    logger.info(`Stopped watcher for library ${libraryId}`);
  }
}

/**
 * Stop all watchers
 */
export async function stopAllWatchers() {
  logger.info('Stopping all file watchers');

  for (const [libraryId, watcher] of watchers) {
    await watcher.close();
    watchers.delete(libraryId);
  }
}

/**
 * Restart watcher for a library (used when settings change)
 */
export async function restartWatcher(library) {
  await stopWatchingLibrary(library.id);

  if (library.enabled && library.watch_enabled) {
    startWatchingLibrary(library);
  }
}

/**
 * Get watcher status
 */
export function getWatcherStatus() {
  const status = {};

  for (const [libraryId, watcher] of watchers) {
    status[libraryId] = {
      watching: true,
      // chokidar doesn't expose watched paths easily, but it's running
    };
  }

  return status;
}

export default {
  startWatching,
  startWatchingLibrary,
  stopWatchingLibrary,
  stopAllWatchers,
  restartWatcher,
  getWatcherStatus,
};
