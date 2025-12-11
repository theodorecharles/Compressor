// API Types for Frontend

export type FileStatus = 'queued' | 'encoding' | 'finished' | 'skipped' | 'excluded' | 'errored' | 'rejected' | 'cancelled';
export type ExclusionType = 'folder' | 'pattern';
export type QueueSortOrder = 'bitrate_desc' | 'bitrate_asc' | 'alphabetical' | 'random';
export type LibraryPriority = 'alphabetical_asc' | 'alphabetical_desc' | 'round_robin';

export interface Library {
  id: number;
  name: string;
  path: string;
  enabled: number;
  watch_enabled: number;
  created_at: string;
  updated_at: string;
  file_count?: number;
}

export interface Exclusion {
  id: number;
  library_id: number | null;
  pattern: string;
  type: ExclusionType;
  reason: string | null;
  created_at: string;
  library_name?: string;
}

export interface File {
  id: number;
  library_id: number;
  file_path: string;
  file_name: string;
  original_codec: string | null;
  original_bitrate: number | null;
  original_size: number | null;
  original_width: number | null;
  original_height: number | null;
  is_hdr: number;
  new_size: number | null;
  status: FileStatus;
  skip_reason: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  library_name?: string;
  encoding_logs?: EncodingLog[];
}

export interface EncodingLog {
  id: number;
  file_id: number;
  event: string;
  details: string | null;
  created_at: string;
}

export interface Stats {
  total_files: number;
  queued: number;
  encoding: number;
  finished: number;
  skipped: number;
  excluded: number;
  errored: number;
  rejected: number;
  total_space_saved: number;
  total_original_size: number;
  percent_saved: number;
  total_space_saved_formatted: string;
}

export interface SpaceSavedData {
  timestamp: string;
  period_saved: number;
  cumulative_saved: number;
  files_processed: number;
  granularity: 'hourly' | 'daily';
}

export type TimeRange = '24h' | '7d' | '30d' | '90d' | '1y' | 'all';

export interface RecentActivity {
  id: number;
  file_name: string;
  status: FileStatus;
  original_size: number | null;
  new_size: number | null;
  completed_at: string | null;
  library_name: string;
  original_size_formatted?: string;
  new_size_formatted?: string | null;
  space_saved?: number | null;
  space_saved_formatted?: string | null;
}

export interface ScanStatus {
  isScanning: boolean;
  currentLibrary: string | null;
  currentLibraryId: number | null;
  totalFiles: number;
  processedFiles: number;
  filesAdded: number;
  filesSkipped: number;
  filesErrored: number;
  currentFile: string | null;
  lastError: { file: string; message: string } | null;
  startedAt: string | null;
}

export interface CurrentEncoding {
  encoding: boolean;
  file: {
    id: number;
    file_name: string;
    file_path: string;
    original_size: number | null;
    original_codec: string | null;
    is_hdr: number;
    original_width: number | null;
    original_height: number | null;
  } | null;
  progress: number;
  isPaused?: boolean;
}

export interface WorkerStatus {
  isRunning: boolean;
  isPaused: boolean;
  currentFile: CurrentEncoding['file'];
  progress: number;
}

export interface QueueResponse extends WorkerStatus {
  queue: File[];
  queue_count: number;
  total: number;
  limit: number;
  offset: number;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  ffprobe: boolean;
  nvenc: boolean;
  worker: boolean;
  worker_paused: boolean;
}

export interface TestResult {
  success: boolean;
  inputPath: string;
  outputPath?: string;
  originalSize?: number;
  outputSize?: number;
  spaceSaved?: number;
  savingsPercent?: number;
  metadata?: {
    codec: string | null;
    bitrate: number | null;
    width: number | null;
    height: number | null;
    isHdr: boolean;
    is4k: boolean;
  };
  error?: string;
}

export interface TestStatus {
  running: boolean;
  files: string[];
  results: TestResult[];
  startedAt: string | null;
  completedAt: string | null;
  summary?: {
    total: number;
    successful: number;
    failed: number;
    total_space_saved: number;
    average_savings_percent: string;
  } | null;
}

export interface FilesResponse {
  files: File[];
  total: number;
  limit: number;
  offset: number;
}

export interface PathExclusionResult {
  excluded: boolean;
  matches: {
    exclusionId: number;
    pattern: string;
    type: ExclusionType;
    reason: string | null;
    libraryId: number | null;
  }[];
}

export interface QueueSettings {
  sort_order: QueueSortOrder;
  library_priority: LibraryPriority;
  available_sort_orders: QueueSortOrder[];
  available_library_priorities: LibraryPriority[];
}
