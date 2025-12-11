import chokidar, { FSWatcher } from 'chokidar';
import { extname } from 'path';
import config from '../config.js';
import logger from '../logger.js';
import { processNewFile } from './scanner.js';
import { getEnabledLibraries } from '../db/queries.js';
import type { Library, WatcherStatus } from '../types/index.js';

const watchers = new Map<number, FSWatcher>();

/**
 * Start watching all enabled libraries with watch_enabled = true
 */
export function startWatching(): void {
  const libraries = getEnabledLibraries().filter(lib => lib.watch_enabled);

  logger.info(`Starting file watchers for ${libraries.length} libraries`);

  for (const library of libraries) {
    startWatchingLibrary(library);
  }
}

/**
 * Start watching a single library
 */
export function startWatchingLibrary(library: Library): void {
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

  watcher.on('add', async (filePath: string) => {
    const ext = extname(filePath).toLowerCase();

    if (!config.videoExtensions.includes(ext)) {
      return;
    }

    logger.info(`New file detected: ${filePath}`);

    try {
      const result = await processNewFile(filePath, library.id);
      logger.info(`New file processed: ${filePath} - ${result}`);
    } catch (error) {
      logger.error(`Error processing new file ${filePath}: ${(error as Error).message}`);
    }
  });

  watcher.on('error', (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Watcher error for library ${library.name}: ${message}`);
  });

  watchers.set(library.id, watcher);
}

/**
 * Stop watching a library
 */
export async function stopWatchingLibrary(libraryId: number): Promise<void> {
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
export async function stopAllWatchers(): Promise<void> {
  logger.info('Stopping all file watchers');

  for (const [libraryId, watcher] of watchers) {
    await watcher.close();
    watchers.delete(libraryId);
  }
}

/**
 * Restart watcher for a library (used when settings change)
 */
export async function restartWatcher(library: Library): Promise<void> {
  await stopWatchingLibrary(library.id);

  if (library.enabled && library.watch_enabled) {
    startWatchingLibrary(library);
  }
}

/**
 * Get watcher status
 */
export function getWatcherStatus(): WatcherStatus {
  const status: WatcherStatus = {};

  for (const [libraryId] of watchers) {
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
