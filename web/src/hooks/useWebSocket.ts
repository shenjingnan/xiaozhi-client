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
  const [wsUrl, setWsUrl] = useState<string>("");

  // 动态获取WebSocket连接地址
  const getWebSocketUrl = useCallback(() => {
    // 优先使用localStorage中保存的地址
    const savedUrl = localStorage.getItem("xiaozhi-ws-url");
    if (savedUrl) {
      return savedUrl;
    }

    // 使用当前页面的 origin，这样可以正确处理端口
    const { protocol, hostname, port } = window.location;
    const wsProtocol = protocol === "https:" ? "wss:" : "ws:";

    // 如果当前页面有端口，就使用当前端口；否则使用默认端口
    if (port) {
      return `${wsProtocol}//${hostname}:${port}`;
    }
    // 当通过标准端口（80/443）访问时，port 为空
    // 这种情况下应该使用相同的标准端口，而不是 9999
    return `${wsProtocol}//${hostname}`;
  }, []);

  useEffect(() => {
    const url = getWebSocketUrl();
    setWsUrl(url);
    const ws = new WebSocket(url);

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
  }, [getWebSocketUrl]);

  const updateConfig = useCallback(
    (config: AppConfig): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          // 先通过 HTTP API 更新
          const apiUrl = `${wsUrl.replace(/^ws(s)?:\/\//, "http$1://")}/api/config`;
          fetch(apiUrl, {
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
    },
    [wsUrl]
  );

  const refreshStatus = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "getStatus" }));
    }
  }, []);

  // 保存自定义WebSocket地址
  const setCustomWsUrl = useCallback((url: string) => {
    if (url) {
      localStorage.setItem("xiaozhi-ws-url", url);
    } else {
      localStorage.removeItem("xiaozhi-ws-url");
    }
    // 重新加载页面以应用新的连接地址
    window.location.reload();
  }, []);

  return {
    ...state,
    updateConfig,
    refreshStatus,
    wsUrl,
    setCustomWsUrl,
  };
}
