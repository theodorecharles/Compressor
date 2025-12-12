import React, { useState, useEffect, FormEvent } from 'react';
import { getExclusions, createExclusion, deleteExclusion, getLibraries } from '../api/client';
import Modal from '../components/Modal';
import type { Exclusion, Library, ExclusionType } from '../types';

interface ExclusionItemProps {
  exclusion: Exclusion;
  onDelete: (id: number) => void;
  showLibrary?: boolean;
}

function ExclusionItem({ exclusion, onDelete, showLibrary }: ExclusionItemProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between bg-neutral-700 rounded-lg p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`badge ${exclusion.type === 'folder' ? 'bg-blue-600' : 'bg-purple-600'}`}>
            {exclusion.type}
          </span>
          {showLibrary && exclusion.library_name && (
            <span className="badge bg-neutral-600">{exclusion.library_name}</span>
          )}
        </div>
        <p className="font-mono text-sm mt-1 truncate">{exclusion.pattern}</p>
        {exclusion.reason && (
          <p className="text-neutral-400 text-sm mt-1">{exclusion.reason}</p>
        )}
      </div>
      <button
        onClick={() => onDelete(exclusion.id)}
        className="btn btn-danger text-sm py-1 ml-4"
      >
        Delete
      </button>
    </div>
  );
}

interface FormData {
  library_id: number | null;
  pattern: string;
  type: ExclusionType;
  reason: string;
}

export default function Exclusions(): React.ReactElement {
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    library_id: null,
    pattern: '',
    type: 'folder',
    reason: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData(): Promise<void> {
    try {
      const [exclusionsData, librariesData] = await Promise.all([
        getExclusions(),
        getLibraries(),
      ]);
      setExclusions(exclusionsData);
      setLibraries(librariesData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal(): void {
    setFormData({
      library_id: null,
      pattern: '',
      type: 'folder',
      reason: '',
    });
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);

    try {
      await createExclusion({
        ...formData,
        library_id: formData.library_id,
      });
      setShowModal(false);
      loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete(id: number): Promise<void> {
    if (!confirm('Are you sure you want to delete this exclusion?')) {
      return;
    }

    try {
      await deleteExclusion(id);
      loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // Group exclusions
  const globalExclusions = exclusions.filter(e => e.library_id === null);
  const libraryExclusions = exclusions.filter(e => e.library_id !== null);

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Exclusions</h1>
        <button onClick={openAddModal} className="btn btn-primary">
          Add Exclusion
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded">
          {error}
        </div>
      )}

      {/* Global Exclusions */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Global Exclusions</h2>
        <p className="text-neutral-400 text-sm mb-4">
          These patterns apply to all libraries.
        </p>

        {globalExclusions.length === 0 ? (
          <p className="text-neutral-500 text-center py-4">No global exclusions</p>
        ) : (
          <div className="space-y-2">
            {globalExclusions.map((exc) => (
              <ExclusionItem key={exc.id} exclusion={exc} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {/* Per-Library Exclusions */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Library-Specific Exclusions</h2>

        {libraryExclusions.length === 0 ? (
          <p className="text-neutral-500 text-center py-4">No library-specific exclusions</p>
        ) : (
          <div className="space-y-2">
            {libraryExclusions.map((exc) => (
              <ExclusionItem key={exc.id} exclusion={exc} onDelete={handleDelete} showLibrary />
            ))}
          </div>
        )}
      </div>

      {/* Example Patterns */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Pattern Examples</h2>
        <div className="text-sm space-y-2 text-neutral-400">
          <p><code className="bg-neutral-700 px-2 py-1 rounded">/media/tv/Frasier</code> - Exact folder match</p>
          <p><code className="bg-neutral-700 px-2 py-1 rounded">**/4K/**</code> - Any file in a 4K subfolder</p>
          <p><code className="bg-neutral-700 px-2 py-1 rounded">**/*Remux*</code> - Any file with "Remux" in the name</p>
          <p><code className="bg-neutral-700 px-2 py-1 rounded">**/Season 01/*</code> - First season of any show</p>
        </div>
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add Exclusion"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Scope</label>
            <select
              className="select w-full"
              value={formData.library_id ?? 'null'}
              onChange={(e) => setFormData({
                ...formData,
                library_id: e.target.value === 'null' ? null : parseInt(e.target.value, 10),
              })}
            >
              <option value="null">Global (all libraries)</option>
              {libraries.map((lib) => (
                <option key={lib.id} value={lib.id}>{lib.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              className="select w-full"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as ExclusionType })}
            >
              <option value="folder">Folder (exact path match)</option>
              <option value="pattern">Pattern (glob/wildcard)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Pattern</label>
            <input
              type="text"
              className="input w-full"
              value={formData.pattern}
              onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
              placeholder={formData.type === 'folder' ? '/media/tv/Frasier' : '**/4K/**'}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Reason (optional)</label>
            <input
              type="text"
              className="input w-full"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="e.g., Keep original quality"
            />
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
              Add
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
