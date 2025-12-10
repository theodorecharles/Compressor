import { Router } from 'express';
import {
  getFiles,
  getFilesCount,
  getFileById,
  updateFile,
  getEncodingLogs,
} from '../../db/queries.js';

const router = Router();

// GET /api/files - List files with pagination/filtering
router.get('/', (req, res) => {
  const {
    status,
    library_id,
    search,
    limit = 50,
    offset = 0,
  } = req.query;

  const filters = {
    status,
    libraryId: library_id ? parseInt(library_id, 10) : undefined,
    search,
    limit: Math.min(parseInt(limit, 10) || 50, 200),
    offset: parseInt(offset, 10) || 0,
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
router.get('/:id', (req, res) => {
  const file = getFileById(parseInt(req.params.id, 10));

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Include encoding logs
  file.encoding_logs = getEncodingLogs(file.id);

  res.json(file);
});

// POST /api/files/:id/retry - Retry errored file
router.post('/:id/retry', (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const file = getFileById(id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.status !== 'errored' && file.status !== 'rejected') {
      return res.status(400).json({
        error: 'Can only retry files with status "errored" or "rejected"',
      });
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
router.post('/:id/skip', (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const file = getFileById(id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.status !== 'queued') {
      return res.status(400).json({
        error: 'Can only skip files with status "queued"',
      });
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
router.post('/:id/exclude', (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const file = getFileById(id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
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
