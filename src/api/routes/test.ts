import { Router, Request, Response, NextFunction } from 'express';
import { mkdir, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { testEncodeFile } from '../../services/encoder.js';
import { getFiles } from '../../db/queries.js';
import logger from '../../logger.js';
import type { TestStatus } from '../../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// Test output directory (inside data folder)
const TEST_OUTPUT_DIR = join(__dirname, '..', '..', '..', 'data', 'test-output');

// POST /api/test/encode - Test encode specific files
router.post('/encode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { file_paths, count = 2 } = req.body;

    // Ensure test output directory exists
    await mkdir(TEST_OUTPUT_DIR, { recursive: true });

    let filesToTest: string[] = [];

    if (file_paths && file_paths.length > 0) {
      // Use specified file paths
      filesToTest = file_paths.slice(0, 5); // Max 5 files
    } else {
      // Pick random queued files
      const queuedFiles = getFiles({ status: 'queued', limit: 100 });

      if (queuedFiles.length === 0) {
        res.status(400).json({
          error: 'No queued files available for testing',
        });
        return;
      }

      // Shuffle and pick
      const shuffled = queuedFiles.sort(() => Math.random() - 0.5);
      filesToTest = shuffled.slice(0, Math.min(count, 5)).map(f => f.file_path);
    }

    logger.info(`Starting test encode for ${filesToTest.length} files`);

    // Return immediately, encoding will happen in background
    res.json({
      message: 'Test encoding started',
      files: filesToTest,
      output_dir: TEST_OUTPUT_DIR,
      note: 'Check /api/test/status for progress. Original files will NOT be modified.',
    });

    // Run test encodes (don't await - run in background)
    runTestEncodes(filesToTest);

  } catch (error) {
    next(error);
  }
});

// In-memory test status storage
const testStatus: TestStatus = {
  running: false,
  files: [],
  results: [],
  startedAt: null,
  completedAt: null,
};

async function runTestEncodes(filePaths: string[]): Promise<void> {
  testStatus.running = true;
  testStatus.files = filePaths;
  testStatus.results = [];
  testStatus.startedAt = new Date().toISOString();
  testStatus.completedAt = null;

  for (const filePath of filePaths) {
    logger.info(`Test encoding: ${filePath}`);

    const result = await testEncodeFile(filePath, TEST_OUTPUT_DIR);
    testStatus.results.push(result);

    logger.info(`Test encode result: ${result.success ? 'SUCCESS' : 'FAILED'} - ${filePath}`);
  }

  testStatus.running = false;
  testStatus.completedAt = new Date().toISOString();
  logger.info('Test encoding batch complete');
}

// GET /api/test/status - Get test encoding status
router.get('/status', (_req: Request, res: Response) => {
  const successfulResults = testStatus.results.filter(r => r.success);
  const failedResults = testStatus.results.filter(r => !r.success);

  res.json({
    ...testStatus,
    summary: testStatus.results.length > 0 ? {
      total: testStatus.results.length,
      successful: successfulResults.length,
      failed: failedResults.length,
      total_space_saved: successfulResults.reduce((sum, r) => sum + (r.spaceSaved || 0), 0),
      average_savings_percent: successfulResults.length > 0
        ? (successfulResults.reduce((sum, r) => sum + (r.savingsPercent || 0), 0) / successfulResults.length).toFixed(2)
        : '0',
    } : null,
  });
});

// DELETE /api/test/cleanup - Clean up test output files
router.delete('/cleanup', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
    await mkdir(TEST_OUTPUT_DIR, { recursive: true });

    testStatus.results = [];
    testStatus.completedAt = null;

    res.json({ message: 'Test output cleaned up' });
  } catch (error) {
    next(error);
  }
});

export default router;
