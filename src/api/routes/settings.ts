import { Router, Request, Response } from 'express';
import { getEncodingSettings, updateEncodingSettings } from '../../db/queries.js';
import type { EncodingSettings } from '../../types/index.js';

const router = Router();

// GET /api/settings - Get all encoding settings
router.get('/', (_req: Request, res: Response) => {
  const settings = getEncodingSettings();
  res.json(settings);
});

// PUT /api/settings - Update encoding settings
router.put('/', (req: Request, res: Response) => {
  const updates: Partial<EncodingSettings> = {};

  // Validate and extract settings from request body
  if (req.body.scale_4k_to_1080p !== undefined) {
    updates.scale_4k_to_1080p = Boolean(req.body.scale_4k_to_1080p);
  }

  if (req.body.bitrate_factor !== undefined) {
    const factor = parseFloat(req.body.bitrate_factor);
    if (isNaN(factor) || factor <= 0 || factor > 1) {
      res.status(400).json({ error: 'bitrate_factor must be a number between 0 and 1' });
      return;
    }
    updates.bitrate_factor = factor;
  }

  if (req.body.bitrate_cap_1080p !== undefined) {
    const cap = parseFloat(req.body.bitrate_cap_1080p);
    if (isNaN(cap) || cap <= 0 || cap > 100) {
      res.status(400).json({ error: 'bitrate_cap_1080p must be a number between 0 and 100 Mbps' });
      return;
    }
    updates.bitrate_cap_1080p = cap;
  }

  if (req.body.bitrate_cap_720p !== undefined) {
    const cap = parseFloat(req.body.bitrate_cap_720p);
    if (isNaN(cap) || cap <= 0 || cap > 100) {
      res.status(400).json({ error: 'bitrate_cap_720p must be a number between 0 and 100 Mbps' });
      return;
    }
    updates.bitrate_cap_720p = cap;
  }

  if (req.body.bitrate_cap_other !== undefined) {
    const cap = parseFloat(req.body.bitrate_cap_other);
    if (isNaN(cap) || cap <= 0 || cap > 100) {
      res.status(400).json({ error: 'bitrate_cap_other must be a number between 0 and 100 Mbps' });
      return;
    }
    updates.bitrate_cap_other = cap;
  }

  if (req.body.min_file_size_mb !== undefined) {
    const size = parseInt(req.body.min_file_size_mb, 10);
    if (isNaN(size) || size < 0 || size > 100000) {
      res.status(400).json({ error: 'min_file_size_mb must be a number between 0 and 100000' });
      return;
    }
    updates.min_file_size_mb = size;
  }

  const settings = updateEncodingSettings(updates);
  res.json(settings);
});

export default router;
