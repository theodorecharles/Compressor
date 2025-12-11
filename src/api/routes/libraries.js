import { Router } from 'express';
import { stat } from 'fs/promises';
import {
  getAllLibraries,
  getLibraryById,
  createLibrary,
  updateLibrary,
  deleteLibrary,
  getLibraryFileCount,
} from '../../db/queries.js';
import { scanLibrary, getScanStatus } from '../../services/scanner.js';
import { restartWatcher } from '../../services/watcher.js';

const router = Router();

// GET /api/libraries - List all libraries
router.get('/', (req, res) => {
  const libraries = getAllLibraries();

  // Add file counts
  const librariesWithCounts = libraries.map(lib => ({
    ...lib,
    file_count: getLibraryFileCount(lib.id),
  }));

  res.json(librariesWithCounts);
});

// GET /api/libraries/:id - Get single library
router.get('/:id', (req, res) => {
  const library = getLibraryById(parseInt(req.params.id, 10));

  if (!library) {
    return res.status(404).json({ error: 'Library not found' });
  }

  library.file_count = getLibraryFileCount(library.id);
  res.json(library);
});

// POST /api/libraries - Create new library
router.post('/', async (req, res, next) => {
  try {
    const { name, path } = req.body;

    if (!name || !path) {
      return res.status(400).json({ error: 'Name and path are required' });
    }

    // Verify path exists and is a directory
    try {
      const stats = await stat(path);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: 'Path is not a directory' });
      }
    } catch (e) {
      return res.status(400).json({ error: 'Path does not exist or is not accessible' });
    }

    const id = createLibrary(name, path);
    const library = getLibraryById(id);

    res.status(201).json(library);
  } catch (error) {
    next(error);
  }
});

// PUT /api/libraries/:id - Update library
router.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const library = getLibraryById(id);

    if (!library) {
      return res.status(404).json({ error: 'Library not found' });
    }

    const { name, path, enabled, watch_enabled } = req.body;

    // If path is being changed, verify it exists
    if (path && path !== library.path) {
      try {
        const stats = await stat(path);
        if (!stats.isDirectory()) {
          return res.status(400).json({ error: 'Path is not a directory' });
        }
      } catch (e) {
        return res.status(400).json({ error: 'Path does not exist or is not accessible' });
      }
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (path !== undefined) updates.path = path;
    if (enabled !== undefined) updates.enabled = enabled ? 1 : 0;
    if (watch_enabled !== undefined) updates.watch_enabled = watch_enabled ? 1 : 0;

    updateLibrary(id, updates);

    // Restart watcher if watch settings changed
    const updatedLibrary = getLibraryById(id);
    await restartWatcher(updatedLibrary);

    res.json(updatedLibrary);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/libraries/:id - Delete library
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const library = getLibraryById(id);

    if (!library) {
      return res.status(404).json({ error: 'Library not found' });
    }

    deleteLibrary(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// POST /api/libraries/:id/scan - Trigger library scan
router.post('/:id/scan', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const library = getLibraryById(id);

    if (!library) {
      return res.status(404).json({ error: 'Library not found' });
    }

    // Check if scan is already in progress
    const status = getScanStatus();
    if (status.isScanning) {
      return res.status(409).json({
        error: 'Scan already in progress',
        currentLibrary: status.currentLibrary
      });
    }

    // Run scan in background
    scanLibrary(library).catch(err => {
      console.error(`Scan error for library ${id}:`, err);
    });

    res.json({ message: 'Scan started', library_id: id });
  } catch (error) {
    next(error);
  }
});

// GET /api/libraries/scan/status - Get current scan status
router.get('/scan/status', (req, res) => {
  const status = getScanStatus();
  res.json(status);
});

export default router;
