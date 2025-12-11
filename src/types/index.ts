// Database Models

export type FileStatus = 'queued' | 'encoding' | 'finished' | 'skipped' | 'excluded' | 'errored' | 'rejected' | 'cancelled';
export type ExclusionType = 'folder' | 'pattern';

// Queue sorting options
export type QueueSortOrder = 'bitrate_desc' | 'bitrate_asc' | 'alphabetical' | 'random';
export type LibraryPriority = 'alphabetical_asc' | 'alphabetical_desc' | 'round_robin';

export interface QueueSettings {
  sort_order: QueueSortOrder;
  library_priority: LibraryPriority;
  last_library_id: number | null; // For round-robin tracking
}

export interface Library {
  id: number;
  name: string;
  path: string;
  enabled: number;
  watch_enabled: number;
  created_at: string;
  updated_at: string;
}

export interface LibraryWithCount extends Library {
  file_count: number;
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
  library_path?: string;
  encoding_logs?: EncodingLog[];
}

export interface Stats {
  id: number;
  date: string;
  total_files_processed: number;
  total_space_saved: number;
  files_finished: number;
  files_skipped: number;
  files_rejected: number;
  files_errored: number;
}

export interface HourlyStats {
  id: number;
  hour_utc: string;
  total_files_processed: number;
  total_space_saved: number;
  files_finished: number;
  files_skipped: number;
  files_rejected: number;
  files_errored: number;
}

export interface EncodingLog {
  id: number;
  file_id: number;
  event: string;
  details: string | null;
  created_at: string;
}

// Query Parameters

export interface FileFilters {
  status?: FileStatus;
  libraryId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface LibraryUpdates {
  name?: string;
  path?: string;
  enabled?: number;
  watch_enabled?: number;
}

export interface ExclusionUpdates {
  library_id?: number | null;
  pattern?: string;
  type?: ExclusionType;
  reason?: string | null;
}

export interface FileUpdates {
  status?: FileStatus;
  skip_reason?: string | null;
  error_message?: string | null;
  new_size?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  original_codec?: string | null;
  original_bitrate?: number | null;
  original_size?: number | null;
  original_width?: number | null;
  original_height?: number | null;
  is_hdr?: number;
}

export interface StatsUpdates {
  total_files_processed?: number;
  total_space_saved?: number;
  files_finished?: number;
  files_skipped?: number;
  files_rejected?: number;
  files_errored?: number;
}

export interface CreateFileData {
  library_id: number;
  file_path: string;
  file_name: string;
  original_codec: string | null;
  original_bitrate: number | null;
  original_size: number | null;
  original_width: number | null;
  original_height: number | null;
  is_hdr: boolean;
  status: FileStatus;
  skip_reason?: string | null;
  error_message?: string | null;
}

// Service Types

export interface VideoMetadata {
  codec: string | null;
  bitrate: number | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  isHdr: boolean;
  duration: number | null;
  isHevc: boolean;
  is4k: boolean;
}

export interface ExclusionCheck {
  excluded: boolean;
  reason?: string;
  pattern?: string;
  exclusionId?: number;
}

export interface ExclusionMatch {
  exclusionId: number;
  pattern: string;
  type: ExclusionType;
  reason: string | null;
  libraryId: number | null;
}

export interface PathExclusionResult {
  excluded: boolean;
  matches: ExclusionMatch[];
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

export interface ScanResult {
  filesFound: number;
  filesAdded: number;
  filesSkipped: number;
}

export interface EncodeResult {
  success: boolean;
  status?: 'finished' | 'rejected' | 'cancelled';
  outputSize?: number;
  spaceSaved?: number;
  error?: string;
}

export interface TestEncodeResult {
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

export interface WorkerStatus {
  isRunning: boolean;
  isPaused: boolean;
  currentFile: {
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
}

export interface WatcherStatus {
  [libraryId: number]: {
    watching: boolean;
  };
}

// API Response Types

export interface OverallStats {
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
}

export interface GpuInfo {
  gpus: {
    index: number;
    name: string;
    memory: {
      total: number;
      used: number;
      free: number;
      unit: string;
    };
    utilization: {
      gpu: number;
      memory: number;
    };
    temperature: number;
  }[];
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  ffprobe: boolean;
  nvenc: boolean;
  worker: boolean;
  worker_paused: boolean;
}

export interface TestStatus {
  running: boolean;
  files: string[];
  results: TestEncodeResult[];
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

// Config Type

export interface Config {
  port: number;
  nodeEnv: string;
  dbPath: string;
  ffmpegPath: string;
  ffprobePath: string;
  bitrateMultiplier: number;
  nvencPreset: string;
  crfFallback: number;
  maxBitrateFallback: string;
  bufSizeFallback: string;
  minFileSizeBytes: number;
  videoExtensions: string[];
  scanIntervalSeconds: number;
  logLevel: string;
}

// Callback Types

export type ProgressCallback = (fileId: number, progress: number) => void;
