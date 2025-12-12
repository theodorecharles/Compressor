import React, { useState, useEffect } from 'react';
import { getFiles, getLibraries, retryFile, skipFile } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { formatBytes } from '../utils/format';
import type { File, Library, FileStatus } from '../types';

interface Filters {
  status: FileStatus | '';
  library_id: string;
  search: string;
  limit: number;
  offset: number;
}

export default function Files(): React.ReactElement {
  const [files, setFiles] = useState<File[]>([]);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filters, setFilters] = useState<Filters>({
    status: '',
    library_id: '',
    search: '',
    limit: 50,
    offset: 0,
  });

  useEffect(() => {
    loadLibraries();
  }, []);

  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  async function loadLibraries(): Promise<void> {
    try {
      const data = await getLibraries();
      setLibraries(data);
    } catch (err) {
      console.error('Failed to load libraries:', err);
    }
  }

  async function loadFiles(): Promise<void> {
    setLoading(true);
    try {
      const data = await getFiles({
        status: filters.status || undefined,
        library_id: filters.library_id || undefined,
        search: filters.search || undefined,
        limit: filters.limit,
        offset: filters.offset,
      });
      setFiles(data.files);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load files:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry(id: number): Promise<void> {
    try {
      await retryFile(id);
      loadFiles();
    } catch (err) {
      alert('Failed to retry: ' + (err as Error).message);
    }
  }

  async function handleSkip(id: number): Promise<void> {
    const reason = prompt('Reason for skipping (optional):');
    if (reason === null) return; // Cancelled

    try {
      await skipFile(id, reason || 'Manually skipped');
      loadFiles();
    } catch (err) {
      alert('Failed to skip: ' + (err as Error).message);
    }
  }

  function handlePageChange(newOffset: number): void {
    setFilters({ ...filters, offset: newOffset });
  }

  const totalPages = Math.ceil(total / filters.limit);
  const currentPage = Math.floor(filters.offset / filters.limit) + 1;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold gradient-text">Files</h1>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Status</label>
            <select
              className="select"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as FileStatus | '', offset: 0 })}
            >
              <option value="">All</option>
              <option value="queued">Queued</option>
              <option value="encoding">Encoding</option>
              <option value="finished">Finished</option>
              <option value="skipped">Skipped</option>
              <option value="excluded">Excluded</option>
              <option value="errored">Errored</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">Library</label>
            <select
              className="select"
              value={filters.library_id}
              onChange={(e) => setFilters({ ...filters, library_id: e.target.value, offset: 0 })}
            >
              <option value="">All</option>
              {libraries.map((lib) => (
                <option key={lib.id} value={lib.id}>{lib.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-neutral-400 mb-1">Search</label>
            <input
              type="text"
              className="input w-full"
              placeholder="Search filename..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, offset: 0 })}
            />
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="text-neutral-400">
        Showing {files.length} of {total} files
      </div>

      {/* Files Table */}
      <div className="card overflow-x-auto">
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : files.length === 0 ? (
          <div className="text-center py-8 text-neutral-400">No files found</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Library</th>
                <th>Original</th>
                <th>New</th>
                <th>Saved</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id} className={file.status === 'errored' ? 'bg-red-900/20' : ''}>
                  <td className="max-w-xs">
                    <button
                      onClick={() => setSelectedFile(file)}
                      className={`text-left truncate block w-full ${
                        file.status === 'errored' ? 'text-red-400 hover:text-red-300' : 'hover:text-green-400'
                      }`}
                    >
                      {file.file_name}
                      {file.status === 'errored' && file.error_message && (
                        <span className="ml-2 text-xs text-red-500">(click for error details)</span>
                      )}
                    </button>
                  </td>
                  <td>{file.library_name}</td>
                  <td>{formatBytes(file.original_size)}</td>
                  <td>{file.new_size ? formatBytes(file.new_size) : '-'}</td>
                  <td className="text-green-400">
                    {file.new_size && file.original_size && file.original_size > file.new_size
                      ? formatBytes(file.original_size - file.new_size)
                      : '-'}
                  </td>
                  <td><StatusBadge status={file.status} /></td>
                  <td>
                    <div className="flex gap-1">
                      {(file.status === 'errored' || file.status === 'rejected') && (
                        <button
                          onClick={() => handleRetry(file.id)}
                          className="btn btn-secondary text-xs py-1 px-2"
                        >
                          Retry
                        </button>
                      )}
                      {file.status === 'queued' && (
                        <button
                          onClick={() => handleSkip(file.id)}
                          className="btn btn-secondary text-xs py-1 px-2"
                        >
                          Skip
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => handlePageChange(filters.offset - filters.limit)}
            disabled={filters.offset === 0}
            className="btn btn-secondary disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-neutral-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(filters.offset + filters.limit)}
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
                <label className="text-neutral-400 text-sm">New Size</label>
                <p>{selectedFile.new_size ? formatBytes(selectedFile.new_size) : '-'}</p>
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
                <p className="text-red-400">{selectedFile.error_message}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
