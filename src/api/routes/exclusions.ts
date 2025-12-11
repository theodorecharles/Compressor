import { Router, Request, Response, NextFunction } from 'express';
import {
  getAllExclusions,
  getExclusionsByLibrary,
  getExclusionById,
  createExclusion,
  updateExclusion,
  deleteExclusion,
  getLibraryById,
} from '../../db/queries.js';
import { checkPathExclusion } from '../../services/exclusions.js';

const router = Router();

// GET /api/exclusions - List all exclusions
router.get('/', (req: Request, res: Response) => {
  const { library_id } = req.query;

  let exclusions;
  if (library_id) {
    exclusions = getExclusionsByLibrary(parseInt(library_id as string, 10));
  } else {
    exclusions = getAllExclusions();
  }

  res.json(exclusions);
});

// GET /api/exclusions/:id - Get single exclusion
router.get('/:id', (req: Request, res: Response) => {
  const exclusion = getExclusionById(parseInt(req.params.id, 10));

  if (!exclusion) {
    res.status(404).json({ error: 'Exclusion not found' });
    return;
  }

  res.json(exclusion);
});

// POST /api/exclusions - Create new exclusion
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { library_id, pattern, type, reason } = req.body;

    if (!pattern) {
      res.status(400).json({ error: 'Pattern is required' });
      return;
    }

    if (!type || !['folder', 'pattern'].includes(type)) {
      res.status(400).json({ error: 'Type must be "folder" or "pattern"' });
      return;
    }

    // Validate library_id if provided
    if (library_id !== null && library_id !== undefined) {
      const library = getLibraryById(library_id);
      if (!library) {
        res.status(400).json({ error: 'Library not found' });
        return;
      }
    }

    const id = createExclusion(
      library_id || null,
      pattern,
      type,
      reason || null
    );

    const exclusion = getExclusionById(Number(id));
    res.status(201).json(exclusion);
  } catch (error) {
    next(error);
  }
});

// PUT /api/exclusions/:id - Update exclusion
router.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const exclusion = getExclusionById(id);

    if (!exclusion) {
      res.status(404).json({ error: 'Exclusion not found' });
      return;
    }

    const { library_id, pattern, type, reason } = req.body;

    const updates: Record<string, string | number | null> = {};
    if (library_id !== undefined) updates.library_id = library_id;
    if (pattern !== undefined) updates.pattern = pattern;
    if (type !== undefined) {
      if (!['folder', 'pattern'].includes(type)) {
        res.status(400).json({ error: 'Type must be "folder" or "pattern"' });
        return;
      }
      updates.type = type;
    }
    if (reason !== undefined) updates.reason = reason;

    updateExclusion(id, updates);

    const updatedExclusion = getExclusionById(id);
    res.json(updatedExclusion);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/exclusions/:id - Delete exclusion
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const exclusion = getExclusionById(id);

    if (!exclusion) {
      res.status(404).json({ error: 'Exclusion not found' });
      return;
    }

    deleteExclusion(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// POST /api/exclusions/check - Check if a path would be excluded
router.post('/check', (req: Request, res: Response) => {
  const { path, library_id } = req.body;

  if (!path) {
    res.status(400).json({ error: 'Path is required' });
    return;
  }

  const result = checkPathExclusion(path, library_id || null);
  res.json(result);
});

export default router;
