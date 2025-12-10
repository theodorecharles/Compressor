import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from '../config.js';
import logger from '../logger.js';

import librariesRouter from './routes/libraries.js';
import exclusionsRouter from './routes/exclusions.js';
import filesRouter from './routes/files.js';
import queueRouter from './routes/queue.js';
import statsRouter from './routes/stats.js';
import systemRouter from './routes/system.js';
import testRouter from './routes/test.js';
import errorHandler from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Request logging
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });

  // API routes
  app.use('/api/libraries', librariesRouter);
  app.use('/api/exclusions', exclusionsRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/queue', queueRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/system', systemRouter);
  app.use('/api/test', testRouter);

  // Serve frontend in production
  if (config.nodeEnv === 'production') {
    const frontendPath = join(__dirname, '..', '..', 'frontend', 'dist');
    app.use(express.static(frontendPath));

    // SPA fallback
    app.get('*', (req, res) => {
      res.sendFile(join(frontendPath, 'index.html'));
    });
  }

  // Error handler
  app.use(errorHandler);

  return app;
}

export function startServer(app) {
  return new Promise((resolve) => {
    const server = app.listen(config.port, () => {
      logger.info(`Server listening on port ${config.port}`);
      resolve(server);
    });
  });
}

export default { createApp, startServer };
