const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || error.error || 'Request failed');
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// Libraries
export const getLibraries = () => request('/libraries');
export const getLibrary = (id) => request(`/libraries/${id}`);
export const createLibrary = (data) => request('/libraries', { method: 'POST', body: data });
export const updateLibrary = (id, data) => request(`/libraries/${id}`, { method: 'PUT', body: data });
export const deleteLibrary = (id) => request(`/libraries/${id}`, { method: 'DELETE' });
export const scanLibrary = (id) => request(`/libraries/${id}/scan`, { method: 'POST' });
export const getScanStatus = () => request('/libraries/scan/status');

// Exclusions
export const getExclusions = (libraryId = null) => {
  const params = libraryId ? `?library_id=${libraryId}` : '';
  return request(`/exclusions${params}`);
};
export const createExclusion = (data) => request('/exclusions', { method: 'POST', body: data });
export const updateExclusion = (id, data) => request(`/exclusions/${id}`, { method: 'PUT', body: data });
export const deleteExclusion = (id) => request(`/exclusions/${id}`, { method: 'DELETE' });
export const checkExclusion = (path, libraryId = null) => request('/exclusions/check', { method: 'POST', body: { path, library_id: libraryId } });

// Files
export const getFiles = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.append(key, value);
    }
  });
  return request(`/files?${searchParams}`);
};
export const getFile = (id) => request(`/files/${id}`);
export const retryFile = (id) => request(`/files/${id}/retry`, { method: 'POST' });
export const skipFile = (id, reason) => request(`/files/${id}/skip`, { method: 'POST', body: { reason } });
export const excludeFile = (id, reason) => request(`/files/${id}/exclude`, { method: 'POST', body: { reason } });

// Queue
export const getQueue = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.append(key, value);
    }
  });
  const queryString = searchParams.toString();
  return request(`/queue${queryString ? `?${queryString}` : ''}`);
};
export const getCurrentEncoding = () => request('/queue/current');
export const pauseQueue = () => request('/queue/pause', { method: 'POST' });
export const resumeQueue = () => request('/queue/resume', { method: 'POST' });

// Stats
export const getStats = () => request('/stats');
export const getStatsHistory = (days = 30) => request(`/stats/history?days=${days}`);
export const getSpaceSaved = (days = 30) => request(`/stats/space-saved?days=${days}`);
export const getRecentActivity = (limit = 20) => request(`/stats/recent?limit=${limit}`);

// System
export const getHealth = () => request('/system/health');
export const getGpuStatus = () => request('/system/gpu');
export const getConfig = () => request('/system/config');

// Test
export const startTestEncode = (data) => request('/test/encode', { method: 'POST', body: data });
export const getTestStatus = () => request('/test/status');
export const cleanupTestFiles = () => request('/test/cleanup', { method: 'DELETE' });

export default {
  getLibraries,
  getLibrary,
  createLibrary,
  updateLibrary,
  deleteLibrary,
  scanLibrary,
  getExclusions,
  createExclusion,
  updateExclusion,
  deleteExclusion,
  checkExclusion,
  getFiles,
  getFile,
  retryFile,
  skipFile,
  excludeFile,
  getQueue,
  getCurrentEncoding,
  pauseQueue,
  resumeQueue,
  getStats,
  getStatsHistory,
  getSpaceSaved,
  getRecentActivity,
  getHealth,
  getGpuStatus,
  getConfig,
  startTestEncode,
  getTestStatus,
  cleanupTestFiles,
};
