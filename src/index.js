import { initDatabase, closeDatabase } from './db/index.js';
import { createApp, startServer } from './api/index.js';
import { scanAllLibraries } from './services/scanner.js';
import { startWatching, stopAllWatchers } from './services/watcher.js';
import { startWorker, stopWorker } from './worker/encoder.js';
import { checkFfprobe } from './services/ffprobe.js';
import { checkFfmpegNvenc } from './services/encoder.js';
import config from './config.js';
import logger from './logger.js';

async function main() {
  logger.info('='.repeat(50));
  logger.info('Compressor - HEVC Media Transcoder');
  logger.info('='.repeat(50));

  // Initialize database
  logger.info('Initializing database...');
  initDatabase();

  // Check FFmpeg/FFprobe availability
  logger.info('Checking FFmpeg and FFprobe...');
  const ffprobeOk = await checkFfprobe();
  const nvencOk = await checkFfmpegNvenc();

  if (!ffprobeOk) {
    logger.error('FFprobe not found or not working. Please install FFmpeg.');
    process.exit(1);
  }

  if (!nvencOk) {
    logger.warn('NVENC not available. Hardware encoding may not work.');
    logger.warn('Make sure you have NVIDIA drivers and CUDA installed.');
  } else {
    logger.info('NVENC encoder detected and available');
  }

  // Create and start Express app
  logger.info('Starting web server...');
  const app = createApp();
  await startServer(app);

  // Scan libraries on startup
  logger.info('Scanning libraries...');
  try {
    await scanAllLibraries();
  } catch (error) {
    logger.error(`Library scan failed: ${error.message}`);
  }

  // Start file watchers
  logger.info('Starting file watchers...');
  startWatching();

  // Start encoding worker
  logger.info('Starting encoding worker...');
  startWorker();

  // Set up periodic rescans
  if (config.scanIntervalSeconds > 0) {
    logger.info(`Scheduling library rescans every ${config.scanIntervalSeconds} seconds`);
    setInterval(async () => {
      logger.info('Running scheduled library scan...');
      try {
        await scanAllLibraries();
      } catch (error) {
        logger.error(`Scheduled scan failed: ${error.message}`);
      }
    }, config.scanIntervalSeconds * 1000);
  }

  logger.info('='.repeat(50));
  logger.info(`Compressor is running at http://localhost:${config.port}`);
  logger.info('='.repeat(50));
}

// Graceful shutdown
async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  stopWorker();
  await stopAllWatchers();
  closeDatabase();

  logger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Start the application
main().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});
