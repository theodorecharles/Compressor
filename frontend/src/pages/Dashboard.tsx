import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getStats, getSpaceSaved, getRecentActivity, getCurrentEncoding, getHealth, cancelEncoding } from '../api/client';
import { usePolling } from '../hooks/useApi';
import StatusBadge from '../components/StatusBadge';
import { formatBytes, formatPercent } from '../utils/format';
import type { Stats, RecentActivity, HealthStatus, SpaceSavedData, CurrentEncoding, TimeRange } from '../types';

interface ChartData extends SpaceSavedData {
  cumulative_gb: number;
  period_gb: number;
  local_time: string;
}

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '24h': '24 Hours',
  '7d': '7 Days',
  '30d': '30 Days',
  '90d': '90 Days',
  '1y': '1 Year',
  'all': 'All Time',
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
  subtitle?: string;
  small?: boolean;
}

function StatCard({ label, value, icon, color = 'text-white', subtitle, small }: StatCardProps): React.ReactElement {
  return (
    <div className={`card shine ${small ? 'p-4' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-neutral-400 text-sm font-medium tracking-wide uppercase">{label}</p>
          <p className={`${small ? 'text-2xl' : 'text-3xl'} font-bold ${color}`} style={{ textShadow: color.includes('green') ? '0 0 20px rgba(34, 197, 94, 0.5)' : color.includes('blue') ? '0 0 20px rgba(59, 130, 246, 0.5)' : color.includes('red') ? '0 0 20px rgba(239, 68, 68, 0.5)' : 'none' }}>{value}</p>
          {subtitle && <p className="text-neutral-500 text-xs mt-1">{subtitle}</p>}
        </div>
        <span className={`${small ? 'text-2xl' : 'text-4xl'}`} style={{ filter: 'drop-shadow(0 0 8px currentColor)' }}>{icon}</span>
      </div>
    </div>
  );
}

type ChartMode = 'cumulative' | 'period';

export default function Dashboard(): React.ReactElement {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [chartMode, setChartMode] = useState<ChartMode>('period');
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const { data: currentEncoding } = usePolling<CurrentEncoding>(getCurrentEncoding, 2000);
  const { data: stats } = usePolling<Stats>(getStats, 5000);
  const { data: recentActivity } = usePolling<RecentActivity[]>(() => getRecentActivity(10), 5000);
  const { data: health } = usePolling<HealthStatus>(getHealth, 5000);

  // Poll chart data every 30 seconds (less frequent since it's historical)
  useEffect(() => {
    loadChartData();
    const interval = setInterval(loadChartData, 30000);
    return () => clearInterval(interval);
  }, [timeRange]);

  function formatLocalTime(utcString: string, granularity: 'hourly' | 'daily'): string {
    const date = new Date(utcString);
    if (granularity === 'hourly') {
      return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
      });
    } else {
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    }
  }

  async function loadChartData(): Promise<void> {
    try {
      const spaceData = await getSpaceSaved(timeRange);
      setChartData(spaceData.map(d => ({
        ...d,
        cumulative_gb: d.cumulative_saved / 1024 / 1024 / 1024,
        period_gb: d.period_saved / 1024 / 1024 / 1024,
        local_time: formatLocalTime(d.timestamp, d.granularity),
      })));
    } catch (err) {
      console.error('Failed to load chart data:', err);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold gradient-text">Dashboard</h1>

      {/* Health Status */}
      {health && (
        <div className={`card ${health.status === 'healthy' ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}`}>
          <div className="flex items-center gap-4">
            <span className={`text-2xl ${health.status === 'healthy' ? 'text-green-500' : 'text-red-500'}`}>
              {health.status === 'healthy' ? '✓' : '✗'}
            </span>
            <div>
              <p className="font-medium">System Status: {health.status}</p>
              <p className="text-sm text-neutral-400">
                FFprobe: {health.ffprobe ? '✓' : '✗'} |
                NVENC: {health.nvenc ? '✓' : '✗'} |
                Worker: {health.worker ? (health.worker_paused ? 'Paused' : 'Running') : 'Stopped'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current Encoding */}
      {currentEncoding?.encoding && currentEncoding.file && (
        <div className="card border-l-4 border-yellow-500">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Currently Encoding</h2>
            <button
              onClick={async () => {
                if (confirm('Cancel the current encoding? The file will be marked as cancelled.')) {
                  try {
                    await cancelEncoding();
                  } catch (err) {
                    console.error('Failed to cancel:', err);
                  }
                }
              }}
              className="btn btn-danger text-sm py-1 px-3"
            >
              Cancel
            </button>
          </div>
          <p className="text-neutral-300 truncate">{currentEncoding.file.file_name}</p>
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-neutral-400 font-medium">Progress</span>
              <span className="font-bold text-yellow-400 neon-yellow">{formatPercent(currentEncoding.progress)}</span>
            </div>
            <div className="progress-container">
              <div
                className="progress-bar-yellow"
                style={{ width: `${Math.max(currentEncoding.progress, 2)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
          <StatCard
            label="Total Files"
            value={stats.total_files}
            icon="🎬"
          />
          <StatCard
            label="Queued"
            value={stats.queued}
            icon="📋"
            color="text-blue-400"
          />
          <StatCard
            label="Completed"
            value={stats.finished}
            icon="✓"
            color="text-green-400"
          />
          <StatCard
            label="Space Saved"
            value={stats.total_space_saved_formatted}
            icon="💾"
            color="text-green-400"
            subtitle={`${stats.percent_saved}% reduction`}
          />
        </div>
      )}

      {/* Stats Row 2 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
          <StatCard
            label="Skipped"
            value={stats.skipped}
            icon="⏭️"
            small
          />
          <StatCard
            label="Excluded"
            value={stats.excluded}
            icon="🚫"
            small
          />
          <StatCard
            label="Rejected"
            value={stats.rejected}
            icon="↩️"
            small
          />
          <StatCard
            label="Errored"
            value={stats.errored}
            icon="⚠️"
            color="text-red-400"
            small
          />
        </div>
      )}

      {/* Space Saved Chart */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold">Space Saved Over Time</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="input py-1 px-2 text-sm"
            >
              {(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map((range) => (
                <option key={range} value={range}>
                  {TIME_RANGE_LABELS[range]}
                </option>
              ))}
            </select>
            <div
              className="flex gap-1 rounded-lg p-1"
              style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.05)' }}
            >
              <button
                onClick={() => setChartMode('cumulative')}
                className={`px-3 py-1 text-sm rounded-md transition-all ${
                  chartMode === 'cumulative'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
                style={chartMode === 'cumulative' ? { border: '1px solid rgba(255, 255, 255, 0.1)' } : {}}
              >
                Cumulative
              </button>
              <button
                onClick={() => setChartMode('period')}
                className={`px-3 py-1 text-sm rounded-md transition-all ${
                  chartMode === 'period'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
                style={chartMode === 'period' ? { border: '1px solid rgba(255, 255, 255, 0.1)' } : {}}
              >
                {chartData[0]?.granularity === 'hourly' ? 'Per Hour' : 'Per Day'}
              </button>
            </div>
          </div>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis
                dataKey="local_time"
                stroke="#94a3b8"
                fontSize={11}
                interval="preserveStartEnd"
                tickFormatter={(value: string) => value}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={12}
                unit=" GB"
                domain={[0, 'auto']}
                tickFormatter={(value: number) => value.toFixed(chartMode === 'period' ? 1 : 0)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(23, 23, 23, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                }}
                formatter={(value: number) => [
                  `${value.toFixed(2)} GB`,
                  chartMode === 'cumulative'
                    ? 'Cumulative Saved'
                    : chartData[0]?.granularity === 'hourly'
                      ? 'Saved This Hour'
                      : 'Saved This Day'
                ]}
                labelFormatter={(label: string) => label}
              />
              <Line
                type="linear"
                dataKey={chartMode === 'cumulative' ? 'cumulative_gb' : 'period_gb'}
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-neutral-400 text-center py-8">No data yet. Start encoding to see stats!</p>
        )}
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        {recentActivity && recentActivity.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Library</th>
                  <th>Status</th>
                  <th>Original</th>
                  <th>New</th>
                  <th>Saved</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((item) => (
                  <tr key={item.id}>
                    <td className="max-w-xs truncate">{item.file_name}</td>
                    <td>{item.library_name}</td>
                    <td><StatusBadge status={item.status} /></td>
                    <td>{formatBytes(item.original_size)}</td>
                    <td>{item.new_size ? formatBytes(item.new_size) : '-'}</td>
                    <td className="text-green-400">
                      {item.space_saved && item.space_saved > 0 ? formatBytes(item.space_saved) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-neutral-400 text-center py-4">No recent activity</p>
        )}
      </div>
    </div>
  );
}
