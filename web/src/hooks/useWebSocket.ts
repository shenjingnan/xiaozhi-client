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

  const updateConfig = useCallback((config: AppConfig): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        // 先通过 HTTP API 更新
        fetch("http://localhost:9999/api/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        })
          .then((response) => {
            if (response.ok) {
              // 然后通过 WebSocket 通知
              socketRef.current?.send(
                JSON.stringify({ type: "updateConfig", config })
              );
              resolve();
            } else {
              return response.text().then((text) => {
                reject(new Error(text || "保存配置失败"));
              });
            }
          })
          .catch(reject);
      } else {
        reject(new Error("WebSocket 未连接"));
      }
    });
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
