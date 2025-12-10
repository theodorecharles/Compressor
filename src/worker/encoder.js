import logger from '../logger.js';
import { encodeFile, setProgressCallback } from '../services/encoder.js';
import {
  getNextQueuedFile,
  updateFile,
  resetEncodingFiles,
  getCurrentEncodingFile,
} from '../db/queries.js';

let isRunning = false;
let isPaused = false;
let currentFile = null;
let currentProgress = 0;

// Progress callback handler
setProgressCallback((fileId, progress) => {
  if (currentFile && currentFile.id === fileId) {
    currentProgress = progress;
  }
});

/**
 * Start the encoding worker
 */
export function startWorker() {
  if (isRunning) {
    logger.warn('Encoding worker is already running');
    return;
  }

  logger.info('Starting encoding worker');
  isRunning = true;
  isPaused = false;

  // Reset any files stuck in 'encoding' state from previous run
  const resetCount = resetEncodingFiles();
  if (resetCount > 0) {
    logger.info(`Reset ${resetCount} files from 'encoding' back to 'queued'`);
  }

  // Start the worker loop
  workerLoop();
}

/**
 * Stop the encoding worker
 */
export function stopWorker() {
  logger.info('Stopping encoding worker');
  isRunning = false;
}

/**
 * Pause the encoding worker
 */
export function pauseWorker() {
  logger.info('Pausing encoding worker');
  isPaused = true;
}

/**
 * Resume the encoding worker
 */
export function resumeWorker() {
  logger.info('Resuming encoding worker');
  isPaused = false;
}

/**
 * Get worker status
 */
export function getWorkerStatus() {
  return {
    isRunning,
    isPaused,
    currentFile: currentFile ? {
      id: currentFile.id,
      file_name: currentFile.file_name,
      file_path: currentFile.file_path,
      original_size: currentFile.original_size,
      original_codec: currentFile.original_codec,
      is_hdr: currentFile.is_hdr,
      original_width: currentFile.original_width,
      original_height: currentFile.original_height,
    } : null,
    progress: currentProgress,
  };
}

/**
 * Main worker loop
 */
async function workerLoop() {
  while (isRunning) {
    // Check if paused
    if (isPaused) {
      await sleep(1000);
      continue;
    }

    // Get next queued file
    const file = getNextQueuedFile();

    if (!file) {
      // No files to process, wait and check again
      await sleep(10000);
      continue;
    }

    // Process the file
    currentFile = file;
    currentProgress = 0;

    logger.info(`Processing file: ${file.file_name}`);

    // Update status to encoding
    updateFile(file.id, {
      status: 'encoding',
      started_at: new Date().toISOString(),
    });

    try {
      const result = await encodeFile(file);
      logger.info(`File ${file.file_name} completed with status: ${result.status || 'error'}`);
    } catch (error) {
      logger.error(`Unexpected error encoding ${file.file_name}: ${error.message}`);
      updateFile(file.id, {
        status: 'errored',
        error_message: error.message,
        completed_at: new Date().toISOString(),
      });
    }

    currentFile = null;
    currentProgress = 0;

    // Small delay between files
    await sleep(1000);
  }
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  startWorker,
  stopWorker,
  pauseWorker,
  resumeWorker,
  getWorkerStatus,
};
