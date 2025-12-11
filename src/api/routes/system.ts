import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import { checkFfprobe } from '../../services/ffprobe.js';
import { checkFfmpegNvenc } from '../../services/encoder.js';
import { getWorkerStatus } from '../../worker/encoder.js';
import { getWatcherStatus } from '../../services/watcher.js';
import config from '../../config.js';
import type { GpuInfo } from '../../types/index.js';

const router = Router();

// Cache for health check results (ffprobe/nvenc availability doesn't change at runtime)
let healthCache: { ffprobe: boolean; nvenc: boolean; checkedAt: number } | null = null;
const HEALTH_CACHE_TTL = 60000; // 1 minute TTL

async function getCachedHealthStatus(): Promise<{ ffprobe: boolean; nvenc: boolean }> {
  const now = Date.now();
  if (healthCache && (now - healthCache.checkedAt) < HEALTH_CACHE_TTL) {
    return { ffprobe: healthCache.ffprobe, nvenc: healthCache.nvenc };
  }

  const [ffprobeOk, nvencOk] = await Promise.all([
    checkFfprobe(),
    checkFfmpegNvenc(),
  ]);

  healthCache = { ffprobe: ffprobeOk, nvenc: nvencOk, checkedAt: now };
  return { ffprobe: ffprobeOk, nvenc: nvencOk };
}

// GET /api/system/health - Health check
router.get('/health', async (_req: Request, res: Response) => {
  const { ffprobe: ffprobeOk, nvenc: nvencOk } = await getCachedHealthStatus();
  const workerStatus = getWorkerStatus();

  const healthy = ffprobeOk && nvencOk;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    ffprobe: ffprobeOk,
    nvenc: nvencOk,
    worker: workerStatus.isRunning,
    worker_paused: workerStatus.isPaused,
  });
});

// GET /api/system/gpu - GPU status
router.get('/gpu', async (_req: Request, res: Response) => {
  try {
    const gpuInfo = await getNvidiaGpuInfo();
    res.json(gpuInfo);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get GPU info',
      message: (error as Error).message,
    });
  }
});

// GET /api/system/config - Get current config (non-sensitive)
router.get('/config', (_req: Request, res: Response) => {
  res.json({
    bitrateMultiplier: config.bitrateMultiplier,
    nvencPreset: config.nvencPreset,
    crfFallback: config.crfFallback,
    minFileSizeMB: config.minFileSizeBytes / 1024 / 1024,
    videoExtensions: config.videoExtensions,
    scanIntervalSeconds: config.scanIntervalSeconds,
  });
});

// GET /api/system/watchers - Get file watcher status
router.get('/watchers', (_req: Request, res: Response) => {
  const status = getWatcherStatus();
  res.json(status);
});

/**
 * Get NVIDIA GPU info using nvidia-smi
 */
async function getNvidiaGpuInfo(): Promise<GpuInfo> {
  return new Promise((resolve, reject) => {
    const proc = spawn('nvidia-smi', [
      '--query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,utilization.memory,temperature.gpu',
      '--format=csv,noheader,nounits',
    ]);

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
        reject(new Error(`nvidia-smi failed: ${stderr}`));
        return;
      }

      try {
        const lines = stdout.trim().split('\n');
        const gpus = lines.map((line, index) => {
          const [name, memTotal, memUsed, memFree, gpuUtil, memUtil, temp] = line.split(', ').map(s => s.trim());
          return {
            index,
            name,
            memory: {
              total: parseInt(memTotal, 10),
              used: parseInt(memUsed, 10),
              free: parseInt(memFree, 10),
              unit: 'MiB',
            },
            utilization: {
              gpu: parseInt(gpuUtil, 10),
              memory: parseInt(memUtil, 10),
            },
            temperature: parseInt(temp, 10),
          };
        });

        resolve({ gpus });
      } catch (e) {
        reject(new Error(`Failed to parse nvidia-smi output: ${(e as Error).message}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to run nvidia-smi: ${err.message}`));
    });
  });
}

export default router;
