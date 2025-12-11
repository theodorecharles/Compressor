import { spawn, ChildProcess } from 'child_process';
import { unlink, stat, copyFile, chown, rename } from 'fs/promises';
import { dirname, basename, join } from 'path';
import { tmpdir } from 'os';
import config from '../config.js';
import logger from '../logger.js';
import { probeFile } from './ffprobe.js';
import { updateFile, createEncodingLog, updateTodayStats, getEncodingSettings } from '../db/queries.js';
import type { File, VideoMetadata, EncodeResult, TestEncodeResult, ProgressCallback, EncodingSettings } from '../types/index.js';

// User/group IDs for file ownership (nobody:users on Unraid)
const FILE_UID = 99;
const FILE_GID = 100;

// Event emitter for progress updates
let progressCallback: ProgressCallback | null = null;

// Current ffmpeg process for cancellation
let currentFfmpegProcess: ChildProcess | null = null;
let isCancelled = false;

export function setProgressCallback(callback: ProgressCallback | null): void {
  progressCallback = callback;
}

/**
 * Cancel the current encoding
 */
export function cancelCurrentEncoding(): boolean {
  if (currentFfmpegProcess) {
    logger.info('Cancelling current encoding...');
    isCancelled = true;
    currentFfmpegProcess.kill('SIGTERM');
    return true;
  }
  return false;
}

/**
 * Encode a file to HEVC
 * Returns: { success: boolean, outputSize?: number, error?: string }
 */
export async function encodeFile(file: File): Promise<EncodeResult> {
  const inputPath = file.file_path;
  const outputDir = dirname(inputPath);
  const inputBasename = basename(inputPath, '.' + inputPath.split('.').pop());
  const inputExt = inputPath.split('.').pop();
  // Copy input and write output to /tmp to reduce I/O on source drive
  const tempInputPath = join(tmpdir(), `compressor-${file.id}-${Date.now()}-input.${inputExt}`);
  const tempOutputPath = join(tmpdir(), `compressor-${file.id}-${Date.now()}-output.mkv`);
  const finalOutputPath = join(outputDir, `${inputBasename}.mkv`);

  logger.info(`Starting encode: ${inputPath}`);
  createEncodingLog(file.id, 'started', { inputPath });

  try {
    // Copy original file to /tmp for encoding
    logger.info(`Copying input to temp: ${tempInputPath}`);
    await copyFile(inputPath, tempInputPath);

    // Get fresh metadata from temp copy
    const metadata = await probeFile(tempInputPath);

    // Build ffmpeg command (read from temp input)
    const ffmpegArgs = buildFfmpegArgs(tempInputPath, tempOutputPath, metadata);

    logger.info(`FFmpeg args: ${ffmpegArgs.join(' ')}`);
    createEncodingLog(file.id, 'ffmpeg_command', { args: ffmpegArgs });

    // Try hardware decode + encode first
    let result = await runFfmpeg(ffmpegArgs, file.id, metadata.duration);

    // If cancelled, handle it
    if (result === 'cancelled') {
      logger.info(`Encoding cancelled for ${inputPath}`);
      await unlink(tempInputPath).catch(() => {});
      await unlink(tempOutputPath).catch(() => {});

      updateFile(file.id, {
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      });

      createEncodingLog(file.id, 'cancelled', { reason: 'User cancelled' });

      return { success: false, status: 'cancelled' };
    }

    // If hardware decode failed, try CPU decode
    if (result === 'failed') {
      logger.warn(`Hardware decode failed for ${inputPath}, trying CPU decode`);
      createEncodingLog(file.id, 'fallback_cpu_decode');

      const cpuArgs = buildFfmpegArgs(tempInputPath, tempOutputPath, metadata, false);
      result = await runFfmpeg(cpuArgs, file.id, metadata.duration);

      // Check for cancellation again
      if (result === 'cancelled') {
        logger.info(`Encoding cancelled for ${inputPath}`);
        await unlink(tempInputPath).catch(() => {});
        await unlink(tempOutputPath).catch(() => {});

        updateFile(file.id, {
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        });

        createEncodingLog(file.id, 'cancelled', { reason: 'User cancelled' });

        return { success: false, status: 'cancelled' };
      }
    }

    if (result === 'failed') {
      throw new Error('FFmpeg encoding failed');
    }

    // Check output file size
    const outputStats = await stat(tempOutputPath);
    const outputSize = outputStats.size;
    const originalSize = file.original_size || 0;

    logger.info(`Encode complete: ${inputPath} - Original: ${formatBytes(originalSize)}, New: ${formatBytes(outputSize)}`);

    // Compare sizes
    if (outputSize >= originalSize) {
      // Output is larger or same - reject
      logger.info(`Output larger than original, rejecting: ${inputPath}`);
      await unlink(tempOutputPath);
      await unlink(tempInputPath);

      updateFile(file.id, {
        status: 'rejected',
        new_size: outputSize,
        completed_at: new Date().toISOString(),
      });

      createEncodingLog(file.id, 'rejected', {
        originalSize,
        outputSize,
        reason: 'Output file is larger than original',
      });

      updateTodayStats({ total_files_processed: 1, files_rejected: 1 });

      return { success: true, status: 'rejected', outputSize };
    }

    // Output is smaller - replace original using safe temp file approach
    logger.info(`Output smaller, replacing original: ${inputPath}`);

    const tempFinalPath = `${finalOutputPath}.temp.mkv`;

    // Step 1: Copy from temp to final location with .temp.mkv extension
    await copyFile(tempOutputPath, tempFinalPath);

    // Set ownership to nobody:users on temp file
    await chown(tempFinalPath, FILE_UID, FILE_GID);

    // Step 2: Delete original file (safe now that we have the temp copy)
    await unlink(inputPath);

    // Step 3: Rename .temp.mkv to final name (atomic operation)
    await rename(tempFinalPath, finalOutputPath);

    // Clean up temp files
    await unlink(tempOutputPath);
    await unlink(tempInputPath);

    const spaceSaved = originalSize - outputSize;

    updateFile(file.id, {
      status: 'finished',
      new_size: outputSize,
      completed_at: new Date().toISOString(),
    });

    createEncodingLog(file.id, 'finished', {
      originalSize,
      outputSize,
      spaceSaved,
      savingsPercent: ((spaceSaved / originalSize) * 100).toFixed(2),
    });

    updateTodayStats({
      total_files_processed: 1,
      total_space_saved: spaceSaved,
      files_finished: 1,
    });

    return { success: true, status: 'finished', outputSize, spaceSaved };

  } catch (error) {
    const errorMessage = (error as Error).message;
    logger.error(`Encode failed: ${inputPath} - ${errorMessage}`);

    // Clean up temp files if they exist
    try {
      await unlink(tempOutputPath);
    } catch {
      // Ignore - file might not exist
    }
    try {
      await unlink(tempInputPath);
    } catch {
      // Ignore - file might not exist
    }
    try {
      await unlink(`${finalOutputPath}.temp.mkv`);
    } catch {
      // Ignore - file might not exist
    }

    updateFile(file.id, {
      status: 'errored',
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    });

    createEncodingLog(file.id, 'error', { error: errorMessage });

    updateTodayStats({ total_files_processed: 1, files_errored: 1 });

    return { success: false, error: errorMessage };
  }
}

/**
 * Build FFmpeg arguments based on file metadata
 */
function buildFfmpegArgs(inputPath: string, outputPath: string, metadata: VideoMetadata, useHwDecode: boolean = true, encodingSettings?: EncodingSettings): string[] {
  const args: string[] = [];

  // Get settings from database if not provided
  const settings = encodingSettings || getEncodingSettings();

  // Hardware acceleration for decoding (if enabled)
  if (useHwDecode) {
    args.push('-hwaccel', 'cuda');
    args.push('-hwaccel_output_format', 'cuda');
  }

  // Input file
  args.push('-i', inputPath);

  // Build video filter chain
  const filters: string[] = [];

  // Scale 4K down to 1080p (if enabled in settings)
  if (metadata.is4k && settings.scale_4k_to_1080p) {
    if (useHwDecode) {
      // Use hardware scaler
      filters.push('scale_cuda=1920:1080:force_original_aspect_ratio=decrease');
    } else {
      filters.push('scale=1920:1080:force_original_aspect_ratio=decrease');
    }
  }

  // HDR to SDR tonemapping
  if (metadata.isHdr) {
    // Need to download from GPU for tonemapping, then format convert
    if (useHwDecode && metadata.is4k && settings.scale_4k_to_1080p) {
      filters.push('hwdownload');
      filters.push('format=nv12');
    }
    filters.push('zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p');
  }

  // Apply filters if any
  if (filters.length > 0) {
    args.push('-vf', filters.join(','));
  }

  // Video codec - NVENC HEVC
  args.push('-c:v', 'hevc_nvenc');

  // Encoding preset
  args.push('-preset', config.nvencPreset);

  // Bitrate - use settings factor of original, with resolution-based caps from settings
  if (metadata.bitrate) {
    // Target bitrate based on factor from settings
    let targetBitrate = Math.floor(metadata.bitrate * settings.bitrate_factor);

    // Apply resolution-based bitrate caps from settings (convert Mbps to bps)
    const BITRATE_CAP_1080P = settings.bitrate_cap_1080p * 1_000_000;
    const BITRATE_CAP_720P = settings.bitrate_cap_720p * 1_000_000;
    const BITRATE_CAP_OTHER = settings.bitrate_cap_other * 1_000_000;

    const height = metadata.height || 1080;

    // Determine the appropriate cap based on resolution
    let cap: number;
    if (metadata.is4k && settings.scale_4k_to_1080p) {
      // 4K scaled to 1080p uses 1080p cap
      cap = BITRATE_CAP_1080P;
    } else if (height > 1080) {
      // Native 4K (not scaled) uses 1080p cap as well
      cap = BITRATE_CAP_1080P;
    } else if (height > 720) {
      // Between 720p and 1080p (e.g., 1080p, 900p)
      cap = BITRATE_CAP_1080P;
    } else if (height <= 720) {
      // 720p and below
      cap = BITRATE_CAP_720P;
    } else {
      // Other resolutions
      cap = BITRATE_CAP_OTHER;
    }

    if (targetBitrate > cap) {
      targetBitrate = cap;
    }

    args.push('-b:v', targetBitrate.toString());
  } else {
    // CRF fallback when bitrate is unknown
    args.push('-cq', config.crfFallback.toString());
    args.push('-maxrate', config.maxBitrateFallback);
    args.push('-bufsize', config.bufSizeFallback);
  }

  // Copy audio streams unchanged
  args.push('-c:a', 'copy');

  // Copy subtitle streams unchanged
  args.push('-c:s', 'copy');

  // Map all streams
  args.push('-map', '0');

  // Overwrite output
  args.push('-y');

  // Output file
  args.push(outputPath);

  return args;
}

/**
 * Run FFmpeg with progress tracking
 * Returns: 'success' | 'failed' | 'cancelled'
 */
function runFfmpeg(args: string[], fileId: number, duration: number | null): Promise<'success' | 'failed' | 'cancelled'> {
  return new Promise((resolve) => {
    const proc = spawn(config.ffmpegPath, args);
    currentFfmpegProcess = proc;
    let stderr = '';

    proc.stderr.on('data', (data: Buffer) => {
      const output = data.toString();
      stderr += output;

      // Parse progress from stderr
      const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (timeMatch && duration && progressCallback) {
        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const seconds = parseInt(timeMatch[3], 10);
        const currentTime = hours * 3600 + minutes * 60 + seconds;
        const progress = Math.min((currentTime / duration) * 100, 100);
        progressCallback(fileId, progress);
      }
    });

    proc.on('close', (code, signal) => {
      currentFfmpegProcess = null;

      // Check if cancelled
      if (isCancelled || signal === 'SIGTERM') {
        isCancelled = false;
        resolve('cancelled');
        return;
      }

      if (code === 0) {
        resolve('success');
      } else {
        logger.error(`FFmpeg failed with code ${code}: ${stderr.slice(-500)}`);
        resolve('failed');
      }
    });

    proc.on('error', (err) => {
      currentFfmpegProcess = null;
      logger.error(`FFmpeg spawn error: ${err.message}`);
      resolve('failed');
    });
  });
}

/**
 * Check if FFmpeg with NVENC is available
 */
export async function checkFfmpegNvenc(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(config.ffmpegPath, ['-encoders']);
    let stdout = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.on('close', () => {
      const hasNvenc = stdout.includes('hevc_nvenc');
      resolve(hasNvenc);
    });

    proc.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Test encode a file without replacing the original
 * Creates output in a test folder for manual review
 */
export async function testEncodeFile(filePath: string, testOutputDir: string): Promise<TestEncodeResult> {
  const inputBasename = basename(filePath, '.' + filePath.split('.').pop());
  const outputPath = join(testOutputDir, `${inputBasename}.test.mkv`);

  logger.info(`Starting TEST encode: ${filePath}`);
  logger.info(`Test output will be saved to: ${outputPath}`);

  try {
    // Get metadata
    const metadata = await probeFile(filePath);

    // Build ffmpeg command
    const ffmpegArgs = buildFfmpegArgs(filePath, outputPath, metadata);

    logger.info(`FFmpeg args: ${ffmpegArgs.join(' ')}`);

    // Try hardware decode + encode first
    let success = await runFfmpeg(ffmpegArgs, 0, metadata.duration);

    // If hardware decode failed, try CPU decode
    if (!success) {
      logger.warn(`Hardware decode failed, trying CPU decode`);
      const cpuArgs = buildFfmpegArgs(filePath, outputPath, metadata, false);
      success = await runFfmpeg(cpuArgs, 0, metadata.duration);
    }

    if (!success) {
      throw new Error('FFmpeg encoding failed');
    }

    // Check output file size
    const inputStats = await stat(filePath);
    const outputStats = await stat(outputPath);
    const originalSize = inputStats.size;
    const outputSize = outputStats.size;
    const spaceSaved = originalSize - outputSize;
    const savingsPercent = ((spaceSaved / originalSize) * 100).toFixed(2);

    logger.info(`TEST encode complete: Original: ${formatBytes(originalSize)}, New: ${formatBytes(outputSize)}, Saved: ${savingsPercent}%`);

    return {
      success: true,
      inputPath: filePath,
      outputPath,
      originalSize,
      outputSize,
      spaceSaved,
      savingsPercent: parseFloat(savingsPercent),
      metadata: {
        codec: metadata.codec,
        bitrate: metadata.bitrate,
        width: metadata.width,
        height: metadata.height,
        isHdr: metadata.isHdr,
        is4k: metadata.is4k,
      },
    };

  } catch (error) {
    const errorMessage = (error as Error).message;
    logger.error(`TEST encode failed: ${filePath} - ${errorMessage}`);

    // Clean up output file if it exists
    try {
      await unlink(outputPath);
    } catch {
      // Ignore
    }

    return {
      success: false,
      inputPath: filePath,
      error: errorMessage,
    };
  }
}

export default { encodeFile, testEncodeFile, checkFfmpegNvenc, setProgressCallback, cancelCurrentEncoding };
