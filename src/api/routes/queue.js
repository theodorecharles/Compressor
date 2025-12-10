import { Router } from 'express';
import {
  getQueuedFiles,
  getCurrentEncodingFile,
} from '../../db/queries.js';
import {
  getWorkerStatus,
  pauseWorker,
  resumeWorker,
} from '../../worker/encoder.js';

const router = Router();

// GET /api/queue - Get queue status
router.get('/', (req, res) => {
  const status = getWorkerStatus();
  const queued = getQueuedFiles(100);

  res.json({
    ...status,
    queue: queued,
    queue_count: queued.length,
  });
});

// GET /api/queue/current - Get currently encoding file
router.get('/current', (req, res) => {
  const status = getWorkerStatus();

  if (!status.currentFile) {
    return res.json({
      encoding: false,
      file: null,
      progress: 0,
    });
  }

  res.json({
    encoding: true,
    file: status.currentFile,
    progress: status.progress,
    isPaused: status.isPaused,
  });
});

// POST /api/queue/pause - Pause encoding
router.post('/pause', (req, res) => {
  pauseWorker();
  const status = getWorkerStatus();
  res.json({ message: 'Queue paused', ...status });
});

// POST /api/queue/resume - Resume encoding
router.post('/resume', (req, res) => {
  resumeWorker();
  const status = getWorkerStatus();
  res.json({ message: 'Queue resumed', ...status });
});

export default router;
