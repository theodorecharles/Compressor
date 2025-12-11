import React, { useState, useEffect } from 'react';
import { startTestEncode, getTestStatus, cleanupTestFiles, getFiles } from '../api/client';
import { formatBytes } from '../utils/format';
import type { File, TestStatus } from '../types';

export default function TestEncode(): React.ReactElement {
  const [status, setStatus] = useState<TestStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(2);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [availableFiles, setAvailableFiles] = useState<File[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);

  useEffect(() => {
    loadStatus();
    loadAvailableFiles();
  }, []);

  useEffect(() => {
    if (status?.running) {
      const interval = setInterval(loadStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [status?.running]);

  async function loadStatus(): Promise<void> {
    try {
      const data = await getTestStatus();
      setStatus(data);
    } catch (err) {
      console.error('Failed to load test status:', err);
    }
  }

  async function loadAvailableFiles(): Promise<void> {
    try {
      const data = await getFiles({ status: 'queued', limit: 100 });
      setAvailableFiles(data.files);
    } catch (err) {
      console.error('Failed to load files:', err);
    }
  }

  async function handleStartTest(): Promise<void> {
    setLoading(true);
    try {
      const body = selectedFiles.length > 0
        ? { file_paths: selectedFiles }
        : { count };

      await startTestEncode(body);
      loadStatus();
    } catch (err) {
      alert('Failed to start test: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCleanup(): Promise<void> {
    if (!confirm('Delete all test output files?')) return;

    try {
      await cleanupTestFiles();
      loadStatus();
      alert('Test files cleaned up');
    } catch (err) {
      alert('Failed to cleanup: ' + (err as Error).message);
    }
  }

  function toggleFile(path: string): void {
    if (selectedFiles.includes(path)) {
      setSelectedFiles(selectedFiles.filter(f => f !== path));
    } else if (selectedFiles.length < 5) {
      setSelectedFiles([...selectedFiles, path]);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Test Encode</h1>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">About Test Encoding</h2>
        <div className="text-slate-300 space-y-2">
          <p>
            Test encoding lets you transcode files <strong>without replacing the originals</strong>.
            Output files are saved to a separate test folder so you can review the quality before
            enabling full encoding.
          </p>
          <p className="text-slate-400 text-sm">
            This is useful for verifying that the encoding settings produce acceptable quality
            for your media.
          </p>
        </div>
      </div>

      {/* Start Test */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Start Test Encode</h2>

        {status?.running ? (
          <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4">
            <p className="text-yellow-200">
              Test encoding is in progress... ({status.results?.length || 0}/{status.files?.length || 0} complete)
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-4 items-end">
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Number of random files
                </label>
                <input
                  type="number"
                  className="input w-24"
                  min="1"
                  max="5"
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value, 10))}
                  disabled={selectedFiles.length > 0}
                />
              </div>
              <span className="text-slate-400 pb-2">or</span>
              <button
                onClick={() => setShowFilePicker(!showFilePicker)}
                className="btn btn-secondary"
              >
                {showFilePicker ? 'Hide' : 'Select'} Specific Files
                {selectedFiles.length > 0 && ` (${selectedFiles.length})`}
              </button>
            </div>

            {showFilePicker && (
              <div className="border border-slate-600 rounded-lg p-4 max-h-60 overflow-y-auto">
                {availableFiles.length === 0 ? (
                  <p className="text-slate-400">No queued files available</p>
                ) : (
                  <div className="space-y-1">
                    {availableFiles.map((file) => (
                      <label
                        key={file.id}
                        className="flex items-center gap-2 p-2 hover:bg-slate-700 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFiles.includes(file.file_path)}
                          onChange={() => toggleFile(file.file_path)}
                          className="rounded"
                        />
                        <span className="truncate flex-1">{file.file_name}</span>
                        <span className="text-slate-400 text-sm">{formatBytes(file.original_size)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleStartTest}
              disabled={loading || status?.running}
              className="btn btn-primary disabled:opacity-50"
            >
              {loading ? 'Starting...' : 'Start Test Encode'}
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {status?.results && status.results.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Test Results</h2>
            <button onClick={handleCleanup} className="btn btn-danger text-sm">
              Delete Test Files
            </button>
          </div>

          {status.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-700 rounded-lg p-3">
                <p className="text-slate-400 text-sm">Total</p>
                <p className="text-xl font-bold">{status.summary.total}</p>
              </div>
              <div className="bg-slate-700 rounded-lg p-3">
                <p className="text-slate-400 text-sm">Successful</p>
                <p className="text-xl font-bold text-green-400">{status.summary.successful}</p>
              </div>
              <div className="bg-slate-700 rounded-lg p-3">
                <p className="text-slate-400 text-sm">Failed</p>
                <p className="text-xl font-bold text-red-400">{status.summary.failed}</p>
              </div>
              <div className="bg-slate-700 rounded-lg p-3">
                <p className="text-slate-400 text-sm">Avg Savings</p>
                <p className="text-xl font-bold text-green-400">{status.summary.average_savings_percent}%</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {status.results.map((result, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${
                  result.success ? 'border-green-600 bg-green-900/20' : 'border-red-600 bg-red-900/20'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {result.inputPath?.split('/').pop() || 'Unknown'}
                    </p>
                    {result.success ? (
                      <div className="text-sm text-slate-300 mt-2 space-y-1">
                        <p>
                          <span className="text-slate-400">Original:</span> {formatBytes(result.originalSize)}
                          {' → '}
                          <span className="text-slate-400">New:</span> {formatBytes(result.outputSize)}
                        </p>
                        <p className="text-green-400">
                          Saved: {formatBytes(result.spaceSaved)} ({result.savingsPercent}%)
                        </p>
                        {result.metadata && (
                          <p className="text-slate-400">
                            {result.metadata.codec} | {result.metadata.width}x{result.metadata.height}
                            {result.metadata.is4k && ' | 4K→1080p'}
                            {result.metadata.isHdr && ' | HDR→SDR'}
                          </p>
                        )}
                        <p className="text-slate-500 text-xs truncate">
                          Output: {result.outputPath}
                        </p>
                      </div>
                    ) : (
                      <p className="text-red-400 text-sm mt-2">{result.error}</p>
                    )}
                  </div>
                  <span className={`text-2xl ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                    {result.success ? '✓' : '✗'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">After Testing</h2>
        <ol className="list-decimal list-inside text-slate-300 space-y-2">
          <li>Review the test output files in the <code className="bg-slate-700 px-1 rounded">data/test-output</code> folder</li>
          <li>Compare video quality with the originals using your preferred video player</li>
          <li>If quality is acceptable, the queue will process files automatically</li>
          <li>Clean up test files when done to save space</li>
        </ol>
      </div>
    </div>
  );
}
