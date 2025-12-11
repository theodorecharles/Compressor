import { Router, Request, Response } from 'express';
import {
  getQueuedFiles,
  getQueuedFilesCount,
} from '../../db/queries.js';
import {
  getWorkerStatus,
  pauseWorker,
  resumeWorker,
} from '../../worker/encoder.js';

const router = Router();

// GET /api/queue - Get queue status
router.get('/', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const status = getWorkerStatus();
  const queued = getQueuedFiles({ limit, offset });
  const total = getQueuedFilesCount();

  res.json({
    ...status,
    queue: queued,
    queue_count: queued.length,
    total,
    limit,
    offset,
  });
});

// GET /api/queue/current - Get currently encoding file
router.get('/current', (_req: Request, res: Response) => {
  const status = getWorkerStatus();

  if (!status.currentFile) {
    res.json({
      encoding: false,
      file: null,
      progress: 0,
    });
    return;
  }

  res.json({
    encoding: true,
    file: status.currentFile,
    progress: status.progress,
    isPaused: status.isPaused,
  });
});

// POST /api/queue/pause - Pause encoding
router.post('/pause', (_req: Request, res: Response) => {
  pauseWorker();
  const status = getWorkerStatus();
  res.json({ message: 'Queue paused', ...status });
});

// POST /api/queue/resume - Resume encoding
router.post('/resume', (_req: Request, res: Response) => {
  resumeWorker();
  const status = getWorkerStatus();
  res.json({ message: 'Queue resumed', ...status });
});

export default router;
