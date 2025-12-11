import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getStats, getSpaceSaved, getRecentActivity, getCurrentEncoding, getHealth } from '../api/client';
import { usePolling } from '../hooks/useApi';
import StatusBadge from '../components/StatusBadge';
import { formatBytes, formatPercent } from '../utils/format';
import type { Stats, RecentActivity, HealthStatus, SpaceSavedData, CurrentEncoding } from '../types';

interface ChartData extends SpaceSavedData {
  cumulative_gb: number;
}

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
    <div className={`card ${small ? 'p-4' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm">{label}</p>
          <p className={`${small ? 'text-xl' : 'text-2xl'} font-bold ${color}`}>{value}</p>
          {subtitle && <p className="text-slate-400 text-xs mt-1">{subtitle}</p>}
        </div>
        <span className={`${small ? 'text-xl' : 'text-3xl'}`}>{icon}</span>
      </div>
    </div>
  );
}

export default function Dashboard(): React.ReactElement {
  const [stats, setStats] = useState<Stats | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  const { data: currentEncoding } = usePolling<CurrentEncoding>(getCurrentEncoding, 2000);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData(): Promise<void> {
    try {
      const [statsData, spaceData, activityData, healthData] = await Promise.all([
        getStats(),
        getSpaceSaved(30),
        getRecentActivity(10),
        getHealth(),
      ]);
      setStats(statsData);
      setChartData(spaceData.map(d => ({
        ...d,
        cumulative_gb: d.cumulative_saved / 1024 / 1024 / 1024,
      })));
      setRecentActivity(activityData);
      setHealth(healthData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Health Status */}
      {health && (
        <div className={`card ${health.status === 'healthy' ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}`}>
          <div className="flex items-center gap-4">
            <span className={`text-2xl ${health.status === 'healthy' ? 'text-green-500' : 'text-red-500'}`}>
              {health.status === 'healthy' ? '✓' : '✗'}
            </span>
            <div>
              <p className="font-medium">System Status: {health.status}</p>
              <p className="text-sm text-slate-400">
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
          <h2 className="text-lg font-semibold mb-2">Currently Encoding</h2>
          <p className="text-slate-300 truncate">{currentEncoding.file.file_name}</p>
          <div className="mt-2">
            <div className="flex justify-between text-sm text-slate-400 mb-1">
              <span>Progress</span>
              <span>{formatPercent(currentEncoding.progress)}</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-yellow-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${currentEncoding.progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <h2 className="text-lg font-semibold mb-4">Space Saved Over Time</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis
                stroke="#94a3b8"
                fontSize={12}
                unit=" GB"
                domain={[0, 'auto']}
                tickFormatter={(value: number) => value.toFixed(0)}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                formatter={(value: number) => [`${value.toFixed(2)} GB`, 'Cumulative Saved']}
              />
              <Line
                type="monotone"
                dataKey="cumulative_gb"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-slate-400 text-center py-8">No data yet. Start encoding to see stats!</p>
        )}
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        {recentActivity.length > 0 ? (
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
          <p className="text-slate-400 text-center py-4">No recent activity</p>
        )}
      </div>
    </div>
  );
}
