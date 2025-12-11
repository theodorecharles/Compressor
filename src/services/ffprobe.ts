import { spawn } from 'child_process';
import config from '../config.js';
import type { VideoMetadata } from '../types/index.js';

interface FFprobeStream {
  codec_type: string;
  codec_name?: string;
  bit_rate?: string;
  width?: number;
  height?: number;
  color_transfer?: string;
  color_primaries?: string;
  side_data_list?: { side_data_type?: string }[];
}

interface FFprobeFormat {
  bit_rate?: string;
  size?: string;
  duration?: string;
}

interface FFprobeData {
  streams?: FFprobeStream[];
  format?: FFprobeFormat;
}

/**
 * Run ffprobe on a file and return parsed metadata
 */
export async function probeFile(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ];

    const proc = spawn(config.ffprobePath, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const data: FFprobeData = JSON.parse(stdout);
        resolve(parseProbeData(data));
      } catch (e) {
        reject(new Error(`Failed to parse ffprobe output: ${(e as Error).message}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn ffprobe: ${err.message}`));
    });
  });
}

/**
 * Parse ffprobe JSON output into our metadata format
 */
function parseProbeData(data: FFprobeData): VideoMetadata {
  const videoStream = data.streams?.find(s => s.codec_type === 'video');

  if (!videoStream) {
    throw new Error('No video stream found');
  }

  // Get bitrate - try stream bitrate first, then format bitrate
  let bitrate: number | null = null;
  if (videoStream.bit_rate) {
    bitrate = parseInt(videoStream.bit_rate, 10);
  } else if (data.format?.bit_rate) {
    // Use format bitrate as fallback (includes audio, but better than nothing)
    bitrate = parseInt(data.format.bit_rate, 10);
  }

  // Get file size
  const fileSize = data.format?.size ? parseInt(data.format.size, 10) : null;

  // Get resolution
  const width = videoStream.width || null;
  const height = videoStream.height || null;

  // Detect HDR
  const isHdr = detectHdr(videoStream);

  // Get codec
  const codec = videoStream.codec_name?.toLowerCase() || null;

  // Get duration
  const duration = data.format?.duration ? parseFloat(data.format.duration) : null;

  return {
    codec,
    bitrate,
    fileSize,
    width,
    height,
    isHdr,
    duration,
    isHevc: codec === 'hevc' || codec === 'h265',
    is4k: (width !== null && width >= 3840) || (height !== null && height >= 2160),
  };
}

/**
 * Detect if video stream is HDR based on color metadata
 */
function detectHdr(videoStream: FFprobeStream): boolean {
  // Check color_transfer for HDR indicators
  const hdrTransfers = ['smpte2084', 'arib-std-b67', 'smpte428'];
  if (videoStream.color_transfer && hdrTransfers.includes(videoStream.color_transfer.toLowerCase())) {
    return true;
  }

  // Check color_primaries for BT.2020
  if (videoStream.color_primaries && videoStream.color_primaries.toLowerCase() === 'bt2020') {
    return true;
  }

  // Check for HDR in side_data (Dolby Vision, HDR10+)
  if (videoStream.side_data_list) {
    for (const sideData of videoStream.side_data_list) {
      if (sideData.side_data_type?.includes('HDR') ||
          sideData.side_data_type?.includes('Dolby Vision')) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if ffprobe is available
 */
export async function checkFfprobe(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(config.ffprobePath, ['-version']);

    proc.on('close', (code) => {
      resolve(code === 0);
    });

    proc.on('error', () => {
      resolve(false);
    });
  });
}

export default { probeFile, checkFfprobe };
