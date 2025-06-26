import { useCallback, useEffect, useRef, useState } from "react";
import type { AppConfig, ClientStatus } from "../types";

interface WebSocketState {
  connected: boolean;
  config: AppConfig | null;
  status: ClientStatus | null;
}

export function useWebSocket() {
  const [state, setState] = useState<WebSocketState>({
    connected: false,
    config: null,
    status: null,
  });
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:9999");

    ws.onopen = () => {
      setState((prev) => ({ ...prev, connected: true }));
      ws.send(JSON.stringify({ type: "getConfig" }));
      ws.send(JSON.stringify({ type: "getStatus" }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case "config":
        case "configUpdate":
          setState((prev) => ({ ...prev, config: message.data }));
          break;
        case "status":
        case "statusUpdate":
          setState((prev) => ({ ...prev, status: message.data }));
          break;
      }
    };

    ws.onclose = () => {
      setState((prev) => ({ ...prev, connected: false }));
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socketRef.current = ws;

    return () => {
      ws.close();
    };
  }, []);

  const updateConfig = useCallback((config: AppConfig) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "updateConfig", config }));
    }
  }, []);

  const refreshStatus = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "getStatus" }));
    }
  }, []);

  return {
    ...state,
    updateConfig,
    refreshStatus,
  };
}
