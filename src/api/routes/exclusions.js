import { Router } from 'express';
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
router.get('/', (req, res) => {
  const { library_id } = req.query;

  let exclusions;
  if (library_id) {
    exclusions = getExclusionsByLibrary(parseInt(library_id, 10));
  } else {
    exclusions = getAllExclusions();
  }

  res.json(exclusions);
});

// GET /api/exclusions/:id - Get single exclusion
router.get('/:id', (req, res) => {
  const exclusion = getExclusionById(parseInt(req.params.id, 10));

  if (!exclusion) {
    return res.status(404).json({ error: 'Exclusion not found' });
  }

  res.json(exclusion);
});

// POST /api/exclusions - Create new exclusion
router.post('/', (req, res, next) => {
  try {
    const { library_id, pattern, type, reason } = req.body;

    if (!pattern) {
      return res.status(400).json({ error: 'Pattern is required' });
    }

    if (!type || !['folder', 'pattern'].includes(type)) {
      return res.status(400).json({ error: 'Type must be "folder" or "pattern"' });
    }

    // Validate library_id if provided
    if (library_id !== null && library_id !== undefined) {
      const library = getLibraryById(library_id);
      if (!library) {
        return res.status(400).json({ error: 'Library not found' });
      }
    }

    const id = createExclusion(
      library_id || null,
      pattern,
      type,
      reason || null
    );

    const exclusion = getExclusionById(id);
    res.status(201).json(exclusion);
  } catch (error) {
    next(error);
  }
});

// PUT /api/exclusions/:id - Update exclusion
router.put('/:id', (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const exclusion = getExclusionById(id);

    if (!exclusion) {
      return res.status(404).json({ error: 'Exclusion not found' });
    }

    const { library_id, pattern, type, reason } = req.body;

    const updates = {};
    if (library_id !== undefined) updates.library_id = library_id;
    if (pattern !== undefined) updates.pattern = pattern;
    if (type !== undefined) {
      if (!['folder', 'pattern'].includes(type)) {
        return res.status(400).json({ error: 'Type must be "folder" or "pattern"' });
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
router.delete('/:id', (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const exclusion = getExclusionById(id);

    if (!exclusion) {
      return res.status(404).json({ error: 'Exclusion not found' });
    }

    deleteExclusion(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// POST /api/exclusions/check - Check if a path would be excluded
router.post('/check', (req, res) => {
  const { path, library_id } = req.body;

  if (!path) {
    return res.status(400).json({ error: 'Path is required' });
  }

  const result = checkPathExclusion(path, library_id || null);
  res.json(result);
});

export default router;
