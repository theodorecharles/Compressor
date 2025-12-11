import { useEffect, useRef, useState, useCallback } from 'react';
import type { ScanStatus } from '../types';

interface WebSocketMessage {
  type: 'scan_progress' | 'scan_complete' | 'encoding_progress' | 'encoding_complete';
  data: unknown;
}

interface UseWebSocketReturn {
  scanStatus: ScanStatus | null;
  isConnected: boolean;
}

export function useWebSocket(): UseWebSocketReturn {
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    // Determine WebSocket URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'scan_progress':
            setScanStatus(message.data as ScanStatus);
            break;
          case 'scan_complete':
            setScanStatus(null);
            break;
          // encoding_progress and encoding_complete can be handled elsewhere if needed
        }
      } catch {
        // Ignore parse errors
      }
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { scanStatus, isConnected };
}

export default useWebSocket;
