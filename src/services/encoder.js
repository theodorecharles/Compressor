import { spawn } from 'child_process';
import { unlink, rename, stat } from 'fs/promises';
import { dirname, basename, join } from 'path';
import config from '../config.js';
import logger from '../logger.js';
import { probeFile } from './ffprobe.js';
import { updateFile, createEncodingLog, updateTodayStats } from '../db/queries.js';

// Event emitter for progress updates
let progressCallback = null;

export function setProgressCallback(callback) {
  progressCallback = callback;
}

/**
 * Encode a file to HEVC
 * Returns: { success: boolean, outputSize?: number, error?: string }
 */
export async function encodeFile(file) {
  const inputPath = file.file_path;
  const outputDir = dirname(inputPath);
  const inputBasename = basename(inputPath, '.' + inputPath.split('.').pop());
  const tempOutputPath = join(outputDir, `${inputBasename}.temp.mkv`);
  const finalOutputPath = join(outputDir, `${inputBasename}.mkv`);

  logger.info(`Starting encode: ${inputPath}`);
  createEncodingLog(file.id, 'started', { inputPath });

  try {
    // Get fresh metadata
    const metadata = await probeFile(inputPath);

    // Build ffmpeg command
    const ffmpegArgs = buildFfmpegArgs(inputPath, tempOutputPath, metadata);

    logger.info(`FFmpeg args: ${ffmpegArgs.join(' ')}`);
    createEncodingLog(file.id, 'ffmpeg_command', { args: ffmpegArgs });

    // Try hardware decode + encode first
    let success = await runFfmpeg(ffmpegArgs, file.id, metadata.duration);

    // If hardware decode failed, try CPU decode
    if (!success) {
      logger.warn(`Hardware decode failed for ${inputPath}, trying CPU decode`);
      createEncodingLog(file.id, 'fallback_cpu_decode');

      const cpuArgs = buildFfmpegArgs(inputPath, tempOutputPath, metadata, false);
      success = await runFfmpeg(cpuArgs, file.id, metadata.duration);
    }

    if (!success) {
      throw new Error('FFmpeg encoding failed');
    }

    // Check output file size
    const outputStats = await stat(tempOutputPath);
    const outputSize = outputStats.size;
    const originalSize = file.original_size;

    logger.info(`Encode complete: ${inputPath} - Original: ${formatBytes(originalSize)}, New: ${formatBytes(outputSize)}`);

    // Compare sizes
    if (outputSize >= originalSize) {
      // Output is larger or same - reject
      logger.info(`Output larger than original, rejecting: ${inputPath}`);
      await unlink(tempOutputPath);

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

    // Output is smaller - replace original
    logger.info(`Output smaller, replacing original: ${inputPath}`);

    // Delete original
    await unlink(inputPath);

    // Rename temp to final
    await rename(tempOutputPath, finalOutputPath);

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
    logger.error(`Encode failed: ${inputPath} - ${error.message}`);

    // Clean up temp file if it exists
    try {
      await unlink(tempOutputPath);
    } catch (e) {
      // Ignore - file might not exist
    }

    updateFile(file.id, {
      status: 'errored',
      error_message: error.message,
      completed_at: new Date().toISOString(),
    });

    createEncodingLog(file.id, 'error', { error: error.message });

    updateTodayStats({ total_files_processed: 1, files_errored: 1 });

    return { success: false, error: error.message };
  }
}

/**
 * Build FFmpeg arguments based on file metadata
 */
function buildFfmpegArgs(inputPath, outputPath, metadata, useHwDecode = true) {
  const args = [];

  // Hardware acceleration for decoding (if enabled)
  if (useHwDecode) {
    args.push('-hwaccel', 'cuda');
    args.push('-hwaccel_output_format', 'cuda');
  }

  // Input file
  args.push('-i', inputPath);

  // Build video filter chain
  const filters = [];

  // Scale 4K down to 1080p
  if (metadata.is4k) {
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
    if (useHwDecode && metadata.is4k) {
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

  // Bitrate - use half of original, or CRF fallback
  if (metadata.bitrate) {
    // Target bitrate is HALF of original (HEVC is ~50% more efficient)
    const targetBitrate = Math.floor(metadata.bitrate / 2);
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
 */
function runFfmpeg(args, fileId, duration) {
  return new Promise((resolve) => {
    const proc = spawn(config.ffmpegPath, args);
    let stderr = '';

    proc.stderr.on('data', (data) => {
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

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        logger.error(`FFmpeg failed with code ${code}: ${stderr.slice(-500)}`);
        resolve(false);
      }
    });

    proc.on('error', (err) => {
      logger.error(`FFmpeg spawn error: ${err.message}`);
      resolve(false);
    });
  });
}

/**
 * Check if FFmpeg with NVENC is available
 */
export async function checkFfmpegNvenc() {
  return new Promise((resolve) => {
    const proc = spawn(config.ffmpegPath, ['-encoders']);
    let stdout = '';

    proc.stdout.on('data', (data) => {
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
function formatBytes(bytes) {
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
export async function testEncodeFile(filePath, testOutputDir) {
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
    let success = await runFfmpeg(ffmpegArgs, null, metadata.duration);

    // If hardware decode failed, try CPU decode
    if (!success) {
      logger.warn(`Hardware decode failed, trying CPU decode`);
      const cpuArgs = buildFfmpegArgs(filePath, outputPath, metadata, false);
      success = await runFfmpeg(cpuArgs, null, metadata.duration);
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
    logger.error(`TEST encode failed: ${filePath} - ${error.message}`);

    // Clean up output file if it exists
    try {
      await unlink(outputPath);
    } catch (e) {
      // Ignore
    }

    return {
      success: false,
      inputPath: filePath,
      error: error.message,
    };
  }
}

export default { encodeFile, testEncodeFile, checkFfmpegNvenc, setProgressCallback };
