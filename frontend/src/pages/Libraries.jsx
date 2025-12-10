import { useState, useEffect } from 'react';
import { getLibraries, createLibrary, updateLibrary, deleteLibrary, scanLibrary } from '../api/client';
import Modal from '../components/Modal';

export default function Libraries() {
  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLibrary, setEditingLibrary] = useState(null);
  const [formData, setFormData] = useState({ name: '', path: '' });
  const [error, setError] = useState(null);

  useEffect(() => {
    loadLibraries();
  }, []);

  async function loadLibraries() {
    try {
      const data = await getLibraries();
      setLibraries(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingLibrary(null);
    setFormData({ name: '', path: '' });
    setShowModal(true);
  }

  function openEditModal(library) {
    setEditingLibrary(library);
    setFormData({ name: library.name, path: library.path });
    setShowModal(true);
  }

  async function handleSubmit(e) {
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
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this library? All file records will be removed.')) {
      return;
    }

    try {
      await deleteLibrary(id);
      loadLibraries();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggle(library, field) {
    try {
      await updateLibrary(library.id, { [field]: !library[field] });
      loadLibraries();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleScan(id) {
    try {
      await scanLibrary(id);
      alert('Scan started! Check the Files page for results.');
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Libraries</h1>
        <button onClick={openAddModal} className="btn btn-primary">
          Add Library
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded">
          {error}
        </div>
      )}

      {libraries.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-slate-400 mb-4">No libraries configured yet.</p>
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
                  <td className="text-slate-400 max-w-xs truncate">{lib.path}</td>
                  <td>{lib.file_count}</td>
                  <td>
                    <ToggleSwitch
                      checked={lib.enabled}
                      onChange={() => handleToggle(lib, 'enabled')}
                    />
                  </td>
                  <td>
                    <ToggleSwitch
                      checked={lib.watch_enabled}
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
            <p className="text-slate-400 text-sm mt-1">
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

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      onClick={onChange}
      className={`relative w-10 h-5 rounded-full transition-colors ${
        checked ? 'bg-green-600' : 'bg-slate-600'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}
