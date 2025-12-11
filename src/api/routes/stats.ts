import { Router, Request, Response } from 'express';
import {
  getOverallStats,
  getStatsHistory,
  getRecentActivity,
  getHourlyStatsHistory,
} from '../../db/queries.js';

const router = Router();

// GET /api/stats - Get overall statistics
router.get('/', (_req: Request, res: Response) => {
  const stats = getOverallStats();

  // Calculate percentage saved
  let percentSaved = 0;
  if (stats.total_original_size > 0) {
    percentSaved = parseFloat(((stats.total_space_saved / stats.total_original_size) * 100).toFixed(2));
  }

  res.json({
    ...stats,
    percent_saved: percentSaved,
    total_space_saved_formatted: formatBytes(stats.total_space_saved),
  });
});

// GET /api/stats/history - Get historical stats
router.get('/history', (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const history = getStatsHistory(days);

  // Reverse to get chronological order
  res.json(history.reverse());
});

// GET /api/stats/space-saved - Get space saved over time for chart
// Supports ranges: 24h, 7d, 30d, 90d, 1y, all
// 24h and 7d return hourly data, others return daily data
router.get('/space-saved', (req: Request, res: Response) => {
  const range = (req.query.range as string) || '7d';

  let granularity: 'hourly' | 'daily';
  let limit: number;

  switch (range) {
    case '24h':
      granularity = 'hourly';
      limit = 24;
      break;
    case '7d':
      granularity = 'hourly';
      limit = 7 * 24;
      break;
    case '30d':
      granularity = 'daily';
      limit = 30;
      break;
    case '90d':
      granularity = 'daily';
      limit = 90;
      break;
    case '1y':
      granularity = 'daily';
      limit = 365;
      break;
    case 'all':
      granularity = 'daily';
      limit = 10000; // Effectively unlimited
      break;
    default:
      granularity = 'hourly';
      limit = 7 * 24;
  }

  if (granularity === 'hourly') {
    const history = getHourlyStatsHistory(limit);

    // Calculate cumulative space saved (data comes in DESC order, reverse for chronological)
    let cumulative = 0;
    const data = history.reverse().map(hour => {
      cumulative += hour.total_space_saved || 0;
      return {
        timestamp: hour.hour_utc,
        period_saved: hour.total_space_saved || 0,
        cumulative_saved: cumulative,
        files_processed: hour.total_files_processed || 0,
        granularity: 'hourly',
      };
    });

    res.json(data);
  } else {
    const history = getStatsHistory(limit);

    // Calculate cumulative space saved (data comes in DESC order, reverse for chronological)
    let cumulative = 0;
    const data = history.reverse().map(day => {
      cumulative += day.total_space_saved || 0;
      return {
        timestamp: day.date + 'T00:00:00Z',
        period_saved: day.total_space_saved || 0,
        cumulative_saved: cumulative,
        files_processed: day.total_files_processed || 0,
        granularity: 'daily',
      };
    });

    res.json(data);
  }
});

// GET /api/stats/recent - Get recent activity
router.get('/recent', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const activity = getRecentActivity(limit);

  // Add formatted sizes
  const formatted = activity.map(item => ({
    ...item,
    original_size_formatted: formatBytes(item.original_size),
    new_size_formatted: item.new_size ? formatBytes(item.new_size) : null,
    space_saved: item.new_size && item.original_size ? item.original_size - item.new_size : null,
    space_saved_formatted: item.new_size && item.original_size ? formatBytes(item.original_size - item.new_size) : null,
  }));

  res.json(formatted);
});

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number | null): string {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default router;
