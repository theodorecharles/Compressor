import type {
  Library,
  Exclusion,
  File,
  Stats,
  SpaceSavedData,
  RecentActivity,
  ScanStatus,
  CurrentEncoding,
  QueueResponse,
  HealthStatus,
  TestStatus,
  FilesResponse,
  PathExclusionResult,
  QueueSettings,
  QueueSortOrder,
  LibraryPriority,
  EncodingSettings,
} from '../types';

const API_BASE = '/api';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const { body, ...restOptions } = options;
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
    },
    ...restOptions,
  };

  if (body && typeof body === 'object') {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || error.error || 'Request failed');
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

// Libraries
export const getLibraries = (): Promise<Library[]> => request('/libraries');
export const getLibrary = (id: number): Promise<Library> => request(`/libraries/${id}`);
export const createLibrary = (data: { name: string; path: string }): Promise<Library> => request('/libraries', { method: 'POST', body: data });
export const updateLibrary = (id: number, data: Partial<Library>): Promise<Library> => request(`/libraries/${id}`, { method: 'PUT', body: data });
export const deleteLibrary = (id: number): Promise<null> => request(`/libraries/${id}`, { method: 'DELETE' });
export const scanLibrary = (id: number): Promise<{ message: string; library_id: number }> => request(`/libraries/${id}/scan`, { method: 'POST' });
export const getScanStatus = (): Promise<ScanStatus> => request('/libraries/scan/status');
export const stopScan = (): Promise<{ message: string }> => request('/libraries/scan/stop', { method: 'POST' });

// Exclusions
export const getExclusions = (libraryId: number | null = null): Promise<Exclusion[]> => {
  const params = libraryId ? `?library_id=${libraryId}` : '';
  return request(`/exclusions${params}`);
};
export const createExclusion = (data: { library_id: number | null; pattern: string; type: string; reason?: string }): Promise<Exclusion> => request('/exclusions', { method: 'POST', body: data });
export const updateExclusion = (id: number, data: Partial<Exclusion>): Promise<Exclusion> => request(`/exclusions/${id}`, { method: 'PUT', body: data });
export const deleteExclusion = (id: number): Promise<null> => request(`/exclusions/${id}`, { method: 'DELETE' });
export const checkExclusion = (path: string, libraryId: number | null = null): Promise<PathExclusionResult> => request('/exclusions/check', { method: 'POST', body: { path, library_id: libraryId } });

// Files
export const getFiles = (params: Record<string, string | number | undefined> = {}): Promise<FilesResponse> => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  return request(`/files?${searchParams}`);
};
export const getFile = (id: number): Promise<File> => request(`/files/${id}`);
export const retryFile = (id: number): Promise<File> => request(`/files/${id}/retry`, { method: 'POST' });
export const skipFile = (id: number, reason?: string): Promise<File> => request(`/files/${id}/skip`, { method: 'POST', body: { reason } });
export const excludeFile = (id: number, reason?: string): Promise<File> => request(`/files/${id}/exclude`, { method: 'POST', body: { reason } });

// Queue
export const getQueue = (params: Record<string, string | number | undefined> = {}): Promise<QueueResponse> => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return request(`/queue${queryString ? `?${queryString}` : ''}`);
};
export const getCurrentEncoding = (): Promise<CurrentEncoding> => request('/queue/current');
export const pauseQueue = (): Promise<{ message: string }> => request('/queue/pause', { method: 'POST' });
export const resumeQueue = (): Promise<{ message: string }> => request('/queue/resume', { method: 'POST' });
export const cancelEncoding = (): Promise<{ message: string }> => request('/queue/cancel', { method: 'POST' });
export const getQueueSettings = (): Promise<QueueSettings> => request('/queue/settings');
export const updateQueueSettings = (data: { sort_order?: QueueSortOrder; library_priority?: LibraryPriority }): Promise<QueueSettings> => request('/queue/settings', { method: 'PUT', body: data });

// Stats
export const getStats = (): Promise<Stats> => request('/stats');
export const getStatsHistory = (days: number = 30): Promise<Stats[]> => request(`/stats/history?days=${days}`);
export const getSpaceSaved = (range: string = '7d'): Promise<SpaceSavedData[]> => request(`/stats/space-saved?range=${range}`);
export const getRecentActivity = (limit: number = 20): Promise<RecentActivity[]> => request(`/stats/recent?limit=${limit}`);

// System
export const getHealth = (): Promise<HealthStatus> => request('/system/health');
export const getGpuStatus = (): Promise<unknown> => request('/system/gpu');
export const getConfig = (): Promise<unknown> => request('/system/config');

// Settings
export const getEncodingSettings = (): Promise<EncodingSettings> => request('/settings');
export const updateEncodingSettings = (data: Partial<EncodingSettings>): Promise<EncodingSettings> => request('/settings', { method: 'PUT', body: data });

// Test
export const startTestEncode = (data: { file_paths?: string[]; count?: number }): Promise<{ message: string; files: string[]; output_dir: string }> => request('/test/encode', { method: 'POST', body: data });
export const getTestStatus = (): Promise<TestStatus> => request('/test/status');
export const cleanupTestFiles = (): Promise<{ message: string }> => request('/test/cleanup', { method: 'DELETE' });

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
  getQueueSettings,
  updateQueueSettings,
  getStats,
  getStatsHistory,
  getSpaceSaved,
  getRecentActivity,
  getHealth,
  getGpuStatus,
  getConfig,
  getEncodingSettings,
  updateEncodingSettings,
  startTestEncode,
  getTestStatus,
  cleanupTestFiles,
};
