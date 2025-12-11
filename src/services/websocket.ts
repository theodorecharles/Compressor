import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import logger from '../logger.js';
import type { ScanStatus } from '../types/index.js';

let wss: WebSocketServer | null = null;

interface WebSocketMessage {
  type: 'scan_progress' | 'scan_complete' | 'encoding_progress' | 'encoding_complete';
  data: unknown;
}

/**
 * Initialize WebSocket server attached to HTTP server
 */
export function initWebSocket(server: Server): void {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    logger.debug('WebSocket client connected');

    ws.on('close', () => {
      logger.debug('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      logger.warn(`WebSocket error: ${error.message}`);
    });
  });

  logger.info('WebSocket server initialized on /ws');
}

/**
 * Broadcast a message to all connected clients
 */
function broadcast(message: WebSocketMessage): void {
  if (!wss) return;

  const messageStr = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

/**
 * Broadcast scan progress update
 */
export function broadcastScanProgress(status: ScanStatus): void {
  broadcast({
    type: 'scan_progress',
    data: status,
  });
}

/**
 * Broadcast scan complete
 */
export function broadcastScanComplete(): void {
  broadcast({
    type: 'scan_complete',
    data: null,
  });
}

/**
 * Broadcast encoding progress update
 */
export function broadcastEncodingProgress(fileId: number, progress: number): void {
  broadcast({
    type: 'encoding_progress',
    data: { fileId, progress },
  });
}

/**
 * Broadcast encoding complete
 */
export function broadcastEncodingComplete(fileId: number, status: string): void {
  broadcast({
    type: 'encoding_complete',
    data: { fileId, status },
  });
}

export default {
  initWebSocket,
  broadcastScanProgress,
  broadcastScanComplete,
  broadcastEncodingProgress,
  broadcastEncodingComplete,
};
