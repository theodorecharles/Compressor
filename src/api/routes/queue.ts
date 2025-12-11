import { Router, Request, Response } from 'express';
import {
  getQueuedFiles,
  getQueuedFilesCount,
  getQueueSettings,
  updateQueueSettings,
} from '../../db/queries.js';
import {
  getWorkerStatus,
  pauseWorker,
  resumeWorker,
} from '../../worker/encoder.js';
import type { QueueSortOrder, LibraryPriority } from '../../types/index.js';

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

// GET /api/queue/settings - Get queue sort settings
router.get('/settings', (_req: Request, res: Response) => {
  const settings = getQueueSettings();
  res.json({
    sort_order: settings.sort_order,
    library_priority: settings.library_priority,
    available_sort_orders: ['bitrate_desc', 'bitrate_asc', 'alphabetical', 'random'],
    available_library_priorities: ['alphabetical_asc', 'alphabetical_desc', 'round_robin'],
  });
});

// PUT /api/queue/settings - Update queue sort settings
router.put('/settings', (req: Request, res: Response) => {
  const { sort_order, library_priority } = req.body;

  const validSortOrders: QueueSortOrder[] = ['bitrate_desc', 'bitrate_asc', 'alphabetical', 'random'];
  const validLibraryPriorities: LibraryPriority[] = ['alphabetical_asc', 'alphabetical_desc', 'round_robin'];

  if (sort_order && !validSortOrders.includes(sort_order)) {
    res.status(400).json({ error: `Invalid sort_order. Must be one of: ${validSortOrders.join(', ')}` });
    return;
  }

  if (library_priority && !validLibraryPriorities.includes(library_priority)) {
    res.status(400).json({ error: `Invalid library_priority. Must be one of: ${validLibraryPriorities.join(', ')}` });
    return;
  }

  const updated = updateQueueSettings({
    sort_order,
    library_priority,
  });

  res.json({
    message: 'Queue settings updated',
    ...updated,
  });
});

export default router;
