import { Router } from 'express';
import {
  getOverallStats,
  getStatsHistory,
  getRecentActivity,
} from '../../db/queries.js';

const router = Router();

// GET /api/stats - Get overall statistics
router.get('/', (req, res) => {
  const stats = getOverallStats();

  // Calculate percentage saved
  let percentSaved = 0;
  if (stats.total_original_size > 0) {
    percentSaved = ((stats.total_space_saved / stats.total_original_size) * 100).toFixed(2);
  }

  res.json({
    ...stats,
    percent_saved: parseFloat(percentSaved),
    total_space_saved_formatted: formatBytes(stats.total_space_saved),
  });
});

// GET /api/stats/history - Get historical stats
router.get('/history', (req, res) => {
  const { days = 30 } = req.query;
  const history = getStatsHistory(parseInt(days, 10));

  // Reverse to get chronological order
  res.json(history.reverse());
});

// GET /api/stats/space-saved - Get space saved over time for chart
router.get('/space-saved', (req, res) => {
  const { days = 30 } = req.query;
  const history = getStatsHistory(parseInt(days, 10));

  // Calculate cumulative space saved
  let cumulative = 0;
  const data = history.reverse().map(day => {
    cumulative += day.total_space_saved || 0;
    return {
      date: day.date,
      daily_saved: day.total_space_saved || 0,
      cumulative_saved: cumulative,
      files_processed: day.total_files_processed || 0,
    };
  });

  res.json(data);
});

// GET /api/stats/recent - Get recent activity
router.get('/recent', (req, res) => {
  const { limit = 20 } = req.query;
  const activity = getRecentActivity(parseInt(limit, 10));

  // Add formatted sizes
  const formatted = activity.map(item => ({
    ...item,
    original_size_formatted: formatBytes(item.original_size),
    new_size_formatted: item.new_size ? formatBytes(item.new_size) : null,
    space_saved: item.new_size ? item.original_size - item.new_size : null,
    space_saved_formatted: item.new_size ? formatBytes(item.original_size - item.new_size) : null,
  }));

  res.json(formatted);
});

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default router;
