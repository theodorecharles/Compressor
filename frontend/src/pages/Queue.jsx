import { useState, useEffect } from 'react';
import { getQueue, pauseQueue, resumeQueue, getCurrentEncoding } from '../api/client';
import { usePolling } from '../hooks/useApi';
import StatusBadge from '../components/StatusBadge';
import { formatBytes, formatPercent } from '../utils/format';

export default function Queue() {
  const [queue, setQueue] = useState([]);
  const [queueStatus, setQueueStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const { data: currentEncoding } = usePolling(getCurrentEncoding, 2000);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadQueue() {
    try {
      const data = await getQueue();
      setQueue(data.queue);
      setQueueStatus(data);
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePause() {
    try {
      await pauseQueue();
      loadQueue();
    } catch (err) {
      alert('Failed to pause: ' + err.message);
    }
  }

  async function handleResume() {
    try {
      await resumeQueue();
      loadQueue();
    } catch (err) {
      alert('Failed to resume: ' + err.message);
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

      {/* Worker Status */}
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
            <p className="text-slate-400 text-sm">
              {queue.length} files in queue
            </p>
          </div>
        </div>
      </div>

      {/* Currently Encoding */}
      {currentEncoding?.encoding && (
        <div className="card border-l-4 border-yellow-500">
          <h2 className="text-lg font-semibold mb-4">Currently Encoding</h2>
          <div className="space-y-4">
            <div>
              <p className="text-lg font-medium truncate">{currentEncoding.file.file_name}</p>
              <p className="text-slate-400 text-sm truncate">{currentEncoding.file.file_path}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Codec:</span>{' '}
                {currentEncoding.file.original_codec || '-'}
              </div>
              <div>
                <span className="text-slate-400">Size:</span>{' '}
                {formatBytes(currentEncoding.file.original_size)}
              </div>
              <div>
                <span className="text-slate-400">Resolution:</span>{' '}
                {currentEncoding.file.original_width}x{currentEncoding.file.original_height}
              </div>
              <div>
                <span className="text-slate-400">HDR:</span>{' '}
                {currentEncoding.file.is_hdr ? 'Yes' : 'No'}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Progress</span>
                <span>{formatPercent(currentEncoding.progress)}</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-4">
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
          <p className="text-slate-300">
            Waiting to start next file...
          </p>
        </div>
      )}

      {!currentEncoding?.encoding && queueStatus?.isPaused && (
        <div className="card border-l-4 border-yellow-500">
          <p className="text-slate-300">
            Queue is paused. Click "Resume Queue" to continue encoding.
          </p>
        </div>
      )}

      {/* Queue List */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">
          Pending Files ({queue.length})
        </h2>

        {queue.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
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
                    <td className="text-slate-400">{index + 1}</td>
                    <td className="max-w-xs truncate">{file.file_name}</td>
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
    </div>
  );
}
