import React, { useState, useEffect } from 'react';
import { getQueue, pauseQueue, resumeQueue, getCurrentEncoding, getQueueSettings, updateQueueSettings } from '../api/client';
import { usePolling } from '../hooks/useApi';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { formatBytes, formatPercent } from '../utils/format';
import type { File, CurrentEncoding, QueueSettings, QueueSortOrder, LibraryPriority } from '../types';

interface Pagination {
  limit: number;
  offset: number;
  [key: string]: number;
}

interface QueueStatus {
  isPaused: boolean;
  isRunning: boolean;
  queue: File[];
  total: number;
}

const SORT_ORDER_LABELS: Record<QueueSortOrder, string> = {
  bitrate_desc: 'Bitrate (Highest First)',
  bitrate_asc: 'Bitrate (Lowest First)',
  alphabetical: 'Alphabetical (A-Z)',
  random: 'Random',
};

const LIBRARY_PRIORITY_LABELS: Record<LibraryPriority, string> = {
  alphabetical_asc: 'Library Name (A-Z)',
  alphabetical_desc: 'Library Name (Z-A)',
  round_robin: 'Round Robin',
};

export default function Queue(): React.ReactElement {
  const [queue, setQueue] = useState<File[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({ limit: 50, offset: 0 });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<QueueSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const { data: currentEncoding } = usePolling<CurrentEncoding>(getCurrentEncoding, 2000);

  useEffect(() => {
    loadQueue();
    loadSettings();
    const interval = setInterval(loadQueue, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination]);

  async function loadSettings(): Promise<void> {
    try {
      const data = await getQueueSettings();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load queue settings:', err);
    }
  }

  async function handleSettingChange(field: 'sort_order' | 'library_priority', value: string): Promise<void> {
    setSettingsLoading(true);
    try {
      const data = await updateQueueSettings({ [field]: value });
      setSettings(data);
      // Reload queue to reflect new ordering
      loadQueue();
    } catch (err) {
      alert('Failed to update setting: ' + (err as Error).message);
    } finally {
      setSettingsLoading(false);
    }
  }

  async function loadQueue(): Promise<void> {
    try {
      const data = await getQueue(pagination);
      setQueue(data.queue);
      setQueueStatus(data);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setLoading(false);
    }
  }

  function handlePageChange(newOffset: number): void {
    setPagination({ ...pagination, offset: newOffset });
  }

  const totalPages = Math.ceil(total / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  async function handlePause(): Promise<void> {
    try {
      await pauseQueue();
      loadQueue();
    } catch (err) {
      alert('Failed to pause: ' + (err as Error).message);
    }
  }

  async function handleResume(): Promise<void> {
    try {
      await resumeQueue();
      loadQueue();
    } catch (err) {
      alert('Failed to resume: ' + (err as Error).message);
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Encoding Queue</h1>
        <div className="flex gap-2">
          {queueStatus?.isPaused ? (
            <button onClick={handleResume} className="btn btn-primary">
              Resume Queue
            </button>
          ) : (
            <button onClick={handlePause} className="btn btn-warning">
              Pause Queue
            </button>
          )}
        </div>
      </div>

      {/* Worker Status and Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${
              queueStatus?.isRunning
                ? queueStatus?.isPaused
                  ? 'bg-yellow-500'
                  : 'bg-green-500 animate-pulse'
                : 'bg-red-500'
            }`} />
            <div>
              <p className="font-medium">
                Worker: {queueStatus?.isRunning
                  ? queueStatus?.isPaused
                    ? 'Paused'
                    : 'Running'
                  : 'Stopped'}
              </p>
              <p className="text-neutral-400 text-sm">
                {total} files in queue
              </p>
            </div>
          </div>
        </div>

        {/* Queue Settings */}
        <div className="card">
          <h3 className="font-medium mb-3">Queue Order</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-400 text-sm block mb-1">File Sort</label>
              <select
                value={settings?.sort_order || 'bitrate_desc'}
                onChange={(e) => handleSettingChange('sort_order', e.target.value)}
                disabled={settingsLoading}
                className="input w-full"
              >
                {settings?.available_sort_orders?.map((order) => (
                  <option key={order} value={order}>
                    {SORT_ORDER_LABELS[order]}
                  </option>
                )) || (
                  <>
                    <option value="bitrate_desc">Bitrate (Highest First)</option>
                    <option value="bitrate_asc">Bitrate (Lowest First)</option>
                    <option value="alphabetical">Alphabetical (A-Z)</option>
                    <option value="random">Random</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="text-neutral-400 text-sm block mb-1">Library Priority</label>
              <select
                value={settings?.library_priority || 'alphabetical_asc'}
                onChange={(e) => handleSettingChange('library_priority', e.target.value)}
                disabled={settingsLoading}
                className="input w-full"
              >
                {settings?.available_library_priorities?.map((priority) => (
                  <option key={priority} value={priority}>
                    {LIBRARY_PRIORITY_LABELS[priority]}
                  </option>
                )) || (
                  <>
                    <option value="alphabetical_asc">Library Name (A-Z)</option>
                    <option value="alphabetical_desc">Library Name (Z-A)</option>
                    <option value="round_robin">Round Robin</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Currently Encoding */}
      {currentEncoding?.encoding && currentEncoding.file && (
        <div className="card border-l-4 border-yellow-500">
          <h2 className="text-lg font-semibold mb-4">Currently Encoding</h2>
          <div className="space-y-4">
            <div>
              <p className="text-lg font-medium truncate">{currentEncoding.file.file_name}</p>
              <p className="text-neutral-400 text-sm truncate">{currentEncoding.file.file_path}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-neutral-400">Codec:</span>{' '}
                {currentEncoding.file.original_codec || '-'}
              </div>
              <div>
                <span className="text-neutral-400">Size:</span>{' '}
                {formatBytes(currentEncoding.file.original_size)}
              </div>
              <div>
                <span className="text-neutral-400">Resolution:</span>{' '}
                {currentEncoding.file.original_width}x{currentEncoding.file.original_height}
              </div>
              <div>
                <span className="text-neutral-400">HDR:</span>{' '}
                {currentEncoding.file.is_hdr ? 'Yes' : 'No'}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Progress</span>
                <span>{formatPercent(currentEncoding.progress)}</span>
              </div>
              <div className="w-full bg-neutral-700 rounded-full h-4">
                <div
                  className="bg-yellow-500 h-4 rounded-full transition-all duration-500 flex items-center justify-center text-xs font-medium"
                  style={{ width: `${Math.max(currentEncoding.progress, 5)}%` }}
                >
                  {currentEncoding.progress > 10 ? formatPercent(currentEncoding.progress) : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!currentEncoding?.encoding && !queueStatus?.isPaused && queue.length > 0 && (
        <div className="card border-l-4 border-blue-500">
          <p className="text-neutral-300">
            Waiting to start next file...
          </p>
        </div>
      )}

      {!currentEncoding?.encoding && queueStatus?.isPaused && (
        <div className="card border-l-4 border-yellow-500">
          <p className="text-neutral-300">
            Queue is paused. Click "Resume Queue" to continue encoding.
          </p>
        </div>
      )}

      {/* Queue List */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">
          Pending Files ({total})
        </h2>

        {total === 0 ? (
          <div className="text-center py-8 text-neutral-400">
            <p>Queue is empty!</p>
            <p className="text-sm mt-2">Add libraries and scan for files to start encoding.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Filename</th>
                  <th>Library</th>
                  <th>Size</th>
                  <th>Codec</th>
                  <th>Resolution</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((file, index) => (
                  <tr key={file.id}>
                    <td className="text-neutral-400">{pagination.offset + index + 1}</td>
                    <td className="max-w-xs">
                      <button
                        onClick={() => setSelectedFile(file)}
                        className="text-left hover:text-green-400 truncate block w-full"
                      >
                        {file.file_name}
                      </button>
                    </td>
                    <td>{file.library_name}</td>
                    <td>{formatBytes(file.original_size)}</td>
                    <td>{file.original_codec || '-'}</td>
                    <td>
                      {file.original_width && file.original_height
                        ? `${file.original_width}x${file.original_height}`
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => handlePageChange(pagination.offset - pagination.limit)}
            disabled={pagination.offset === 0}
            className="btn btn-secondary disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-neutral-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(pagination.offset + pagination.limit)}
            disabled={currentPage >= totalPages}
            className="btn btn-secondary disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* File Detail Modal */}
      <Modal
        isOpen={!!selectedFile}
        onClose={() => setSelectedFile(null)}
        title="File Details"
      >
        {selectedFile && (
          <div className="space-y-4">
            <div>
              <label className="text-neutral-400 text-sm">Filename</label>
              <p className="font-medium break-all">{selectedFile.file_name}</p>
            </div>
            <div>
              <label className="text-neutral-400 text-sm">Full Path</label>
              <p className="font-mono text-sm break-all">{selectedFile.file_path}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-neutral-400 text-sm">Original Codec</label>
                <p>{selectedFile.original_codec || '-'}</p>
              </div>
              <div>
                <label className="text-neutral-400 text-sm">Original Bitrate</label>
                <p>{selectedFile.original_bitrate ? `${(selectedFile.original_bitrate / 1000000).toFixed(2)} Mbps` : '-'}</p>
              </div>
              <div>
                <label className="text-neutral-400 text-sm">Resolution</label>
                <p>{selectedFile.original_width && selectedFile.original_height
                  ? `${selectedFile.original_width}x${selectedFile.original_height}`
                  : '-'}</p>
              </div>
              <div>
                <label className="text-neutral-400 text-sm">HDR</label>
                <p>{selectedFile.is_hdr ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <label className="text-neutral-400 text-sm">Original Size</label>
                <p>{formatBytes(selectedFile.original_size)}</p>
              </div>
              <div>
                <label className="text-neutral-400 text-sm">Library</label>
                <p>{selectedFile.library_name}</p>
              </div>
            </div>
            <div>
              <label className="text-neutral-400 text-sm">Status</label>
              <p><StatusBadge status={selectedFile.status} /></p>
            </div>
            {selectedFile.skip_reason && (
              <div>
                <label className="text-neutral-400 text-sm">Skip Reason</label>
                <p>{selectedFile.skip_reason}</p>
              </div>
            )}
            {selectedFile.error_message && (
              <div>
                <label className="text-neutral-400 text-sm">Error</label>
                <p className="text-red-400 font-mono text-sm whitespace-pre-wrap">{selectedFile.error_message}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
