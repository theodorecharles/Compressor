import React, { useState, useEffect, FormEvent } from 'react';
import { getLibraries, createLibrary, updateLibrary, deleteLibrary, scanLibrary, getScanStatus, stopScan } from '../api/client';
import Modal from '../components/Modal';
import { formatPercent } from '../utils/format';
import { useWebSocket } from '../hooks/useWebSocket';
import type { Library, ScanStatus } from '../types';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
}

function ToggleSwitch({ checked, onChange }: ToggleSwitchProps): React.ReactElement {
  return (
    <button
      onClick={onChange}
      className={`toggle-track ${checked ? 'active' : ''}`}
    >
      <span className="toggle-thumb" />
    </button>
  );
}

export default function Libraries(): React.ReactElement {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLibrary, setEditingLibrary] = useState<Library | null>(null);
  const [formData, setFormData] = useState({ name: '', path: '' });
  const [error, setError] = useState<string | null>(null);
  const [localScanStatus, setLocalScanStatus] = useState<ScanStatus | null>(null);

  // Use WebSocket for real-time scan updates
  const { scanStatus: wsScanStatus, isConnected: wsConnected } = useWebSocket();

  // Prefer WebSocket status, fall back to local status
  const scanStatus = wsScanStatus ?? localScanStatus;

  useEffect(() => {
    loadLibraries();
    loadScanStatus();
  }, []);

  // Poll for scan status when WebSocket isn't connected
  useEffect(() => {
    if (wsConnected) return; // Don't poll if WebSocket is working

    const interval = setInterval(loadScanStatus, 1000);
    return () => clearInterval(interval);
  }, [wsConnected]);

  // Refresh library file counts during scanning
  useEffect(() => {
    if (!scanStatus?.isScanning) return;

    const interval = setInterval(loadLibraries, 2000);
    return () => clearInterval(interval);
  }, [scanStatus?.isScanning]);

  async function loadScanStatus(): Promise<void> {
    try {
      const status = await getScanStatus();
      if (status.isScanning) {
        setLocalScanStatus(status);
      } else {
        setLocalScanStatus(null);
      }
    } catch {
      // Ignore errors
    }
  }

  async function loadLibraries(): Promise<void> {
    try {
      const data = await getLibraries();
      setLibraries(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal(): void {
    setEditingLibrary(null);
    setFormData({ name: '', path: '' });
    setShowModal(true);
  }

  function openEditModal(library: Library): void {
    setEditingLibrary(library);
    setFormData({ name: library.name, path: library.path });
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);

    try {
      if (editingLibrary) {
        await updateLibrary(editingLibrary.id, formData);
      } else {
        await createLibrary(formData);
      }
      setShowModal(false);
      loadLibraries();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete(id: number): Promise<void> {
    if (!confirm('Are you sure you want to delete this library? All file records will be removed.')) {
      return;
    }

    try {
      await deleteLibrary(id);
      loadLibraries();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleToggle(library: Library, field: 'enabled' | 'watch_enabled'): Promise<void> {
    try {
      await updateLibrary(library.id, { [field]: !library[field] });
      loadLibraries();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleScan(id: number): Promise<void> {
    try {
      await scanLibrary(id);
      // Status will auto-update via polling
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold gradient-text">Libraries</h1>
        <button onClick={openAddModal} className="btn btn-primary">
          Add Library
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded">
          {error}
        </div>
      )}

      {/* Scan Status */}
      {scanStatus?.isScanning && (
        <div className="card border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Scanning: {scanStatus.currentLibrary}</h2>
            <button
              onClick={async () => {
                try {
                  await stopScan();
                  setLocalScanStatus(null); // Immediately hide the UI
                } catch (err) {
                  console.error('Failed to stop scan:', err);
                }
              }}
              className="btn btn-danger text-sm py-1 px-3"
            >
              Stop
            </button>
          </div>
          <div className="space-y-4">
            {/* Finding files state */}
            {scanStatus.totalFiles < 0 ? (
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                <span className="text-neutral-300">Finding video files...</span>
              </div>
            ) : (
              <>
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-neutral-400 font-medium">Progress</span>
                    <span className="font-bold text-blue-400 neon-blue">{scanStatus.processedFiles.toLocaleString()} / {scanStatus.totalFiles.toLocaleString()} files</span>
                  </div>
                  <div className="progress-container h-5">
                    <div
                      className="progress-bar-blue flex items-center justify-center text-xs font-bold"
                      style={{ width: `${scanStatus.totalFiles > 0 ? Math.max((scanStatus.processedFiles / scanStatus.totalFiles) * 100, 2) : 0}%` }}
                    >
                      {scanStatus.totalFiles > 0 && (scanStatus.processedFiles / scanStatus.totalFiles) > 0.15 ? formatPercent((scanStatus.processedFiles / scanStatus.totalFiles) * 100) : ''}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-neutral-400">Added:</span>{' '}
                    <span className="text-green-400">{scanStatus.filesAdded.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400">Skipped:</span>{' '}
                    <span className="text-yellow-400">{scanStatus.filesSkipped.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400">Errors:</span>{' '}
                    <span className="text-red-400">{scanStatus.filesErrored.toLocaleString()}</span>
                  </div>
                </div>

                {/* Current file */}
                {scanStatus.currentFile && (
                  <div>
                    <span className="text-neutral-400 text-sm">Current file:</span>
                    <p className="font-mono text-xs text-neutral-300 truncate">{scanStatus.currentFile}</p>
                  </div>
                )}
              </>
            )}

            {/* Last error */}
            {scanStatus.lastError && (
              <div className="bg-red-900/30 border border-red-700 rounded p-3">
                <span className="text-red-400 text-sm font-medium">Last error:</span>
                <p className="font-mono text-xs text-red-300 truncate">{scanStatus.lastError.file}</p>
                <p className="text-red-400 text-sm">{scanStatus.lastError.message}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {libraries.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-neutral-400 mb-4">No libraries configured yet.</p>
          <button onClick={openAddModal} className="btn btn-primary">
            Add Your First Library
          </button>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Path</th>
                <th>Files</th>
                <th>Enabled</th>
                <th>Watch</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {libraries.map((lib) => (
                <tr key={lib.id}>
                  <td className="font-medium">{lib.name}</td>
                  <td className="text-neutral-400 max-w-xs truncate">{lib.path}</td>
                  <td>{lib.file_count}</td>
                  <td>
                    <ToggleSwitch
                      checked={!!lib.enabled}
                      onChange={() => handleToggle(lib, 'enabled')}
                    />
                  </td>
                  <td>
                    <ToggleSwitch
                      checked={!!lib.watch_enabled}
                      onChange={() => handleToggle(lib, 'watch_enabled')}
                    />
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleScan(lib.id)}
                        className="btn btn-secondary text-sm py-1"
                      >
                        Scan
                      </button>
                      <button
                        onClick={() => openEditModal(lib)}
                        className="btn btn-secondary text-sm py-1"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(lib.id)}
                        className="btn btn-danger text-sm py-1"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingLibrary ? 'Edit Library' : 'Add Library'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              className="input w-full"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Movies"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Path</label>
            <input
              type="text"
              className="input w-full"
              value={formData.path}
              onChange={(e) => setFormData({ ...formData, path: e.target.value })}
              placeholder="e.g., /media/movies"
              required
            />
            <p className="text-neutral-400 text-sm mt-1">
              Absolute path to the media folder
            </p>
          </div>
          {error && (
            <div className="text-red-400 text-sm">{error}</div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingLibrary ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
