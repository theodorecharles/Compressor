import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Config } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config: Config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  dbPath: process.env.DB_PATH || join(__dirname, '..', 'data', 'compressor.db'),

  // FFmpeg
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  ffprobePath: process.env.FFPROBE_PATH || 'ffprobe',

  // Encoding settings
  bitrateMultiplier: parseFloat(process.env.BITRATE_MULTIPLIER || '0.5'),
  nvencPreset: process.env.NVENC_PRESET || 'p4',
  crfFallback: parseInt(process.env.CRF_FALLBACK || '24', 10),
  maxBitrateFallback: process.env.MAX_BITRATE_FALLBACK || '8M',
  bufSizeFallback: process.env.BUF_SIZE_FALLBACK || '16M',

  // File settings
  minFileSizeBytes: parseInt(process.env.MIN_FILE_SIZE_MB || '500', 10) * 1024 * 1024,
  // Comprehensive list of video extensions FFmpeg can handle
  videoExtensions: [
    '.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v',
    '.mpeg', '.mpg', '.ts', '.mts', '.m2ts', '.vob', '.ogv', '.ogm',
    '.divx', '.xvid', '.3gp', '.3g2', '.f4v', '.asf', '.rm', '.rmvb',
    '.dv', '.mxf', '.nutmeg', '.nut', '.qt', '.yuv', '.y4m', '.mp2',
    '.mpv', '.m2v', '.m4p', '.wtv', '.dvr-ms', '.h264', '.h265', '.hevc',
  ],

  // Scanning
  scanIntervalSeconds: parseInt(process.env.SCAN_INTERVAL || '3600', 10),

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};

export default config;
