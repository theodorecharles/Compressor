import { Router, Request, Response, NextFunction } from 'express';
import {
  getFiles,
  getFilesCount,
  getFileById,
  updateFile,
  getEncodingLogs,
} from '../../db/queries.js';
import type { FileStatus } from '../../types/index.js';

const router = Router();

// GET /api/files - List files with pagination/filtering
router.get('/', (req: Request, res: Response) => {
  const {
    status,
    library_id,
    search,
    limit = '50',
    offset = '0',
  } = req.query;

  const filters = {
    status: status as FileStatus | undefined,
    libraryId: library_id ? parseInt(library_id as string, 10) : undefined,
    search: search as string | undefined,
    limit: Math.min(parseInt(limit as string, 10) || 50, 200),
    offset: parseInt(offset as string, 10) || 0,
  };

  const files = getFiles(filters);
  const total = getFilesCount(filters);

  res.json({
    files,
    total,
    limit: filters.limit,
    offset: filters.offset,
  });
});

// GET /api/files/:id - Get file details
router.get('/:id', (req: Request, res: Response) => {
  const file = getFileById(parseInt(req.params.id, 10));

  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  // Include encoding logs
  const fileWithLogs = {
    ...file,
    encoding_logs: getEncodingLogs(file.id),
  };

  res.json(fileWithLogs);
});

// POST /api/files/:id/retry - Retry errored file
router.post('/:id/retry', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const file = getFileById(id);

    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    if (file.status !== 'errored' && file.status !== 'rejected') {
      res.status(400).json({
        error: 'Can only retry files with status "errored" or "rejected"',
      });
      return;
    }

    updateFile(id, {
      status: 'queued',
      error_message: null,
      started_at: null,
      completed_at: null,
    });

    const updatedFile = getFileById(id);
    res.json(updatedFile);
  } catch (error) {
    next(error);
  }
});

// POST /api/files/:id/skip - Manually skip a file
router.post('/:id/skip', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const file = getFileById(id);

    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    if (file.status !== 'queued') {
      res.status(400).json({
        error: 'Can only skip files with status "queued"',
      });
      return;
    }

    const { reason } = req.body;

    updateFile(id, {
      status: 'skipped',
      skip_reason: reason || 'Manually skipped',
    });

    const updatedFile = getFileById(id);
    res.json(updatedFile);
  } catch (error) {
    next(error);
  }
});

// POST /api/files/:id/exclude - Exclude a file (and optionally its folder)
router.post('/:id/exclude', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const file = getFileById(id);

    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const { reason } = req.body;

    updateFile(id, {
      status: 'excluded',
      skip_reason: reason || 'Manually excluded',
    });

    const updatedFile = getFileById(id);
    res.json(updatedFile);
  } catch (error) {
    next(error);
  }
});

export default router;
