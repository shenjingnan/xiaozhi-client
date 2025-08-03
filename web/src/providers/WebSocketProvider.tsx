import { createContext, useContext, type ReactNode } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import type { AppConfig } from "../types";

interface WebSocketContextType {
  updateConfig: (config: AppConfig) => Promise<void>;
  refreshStatus: () => void;
  restartService: () => Promise<void>;
  setCustomWsUrl: (url: string) => void;
  changePort: (newPort: number) => Promise<void>;
  wsUrl: string;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const webSocketState = useWebSocket();

  const contextValue: WebSocketContextType = {
    updateConfig: webSocketState.updateConfig,
    refreshStatus: webSocketState.refreshStatus,
    restartService: webSocketState.restartService,
    setCustomWsUrl: webSocketState.setCustomWsUrl,
    changePort: webSocketState.changePort,
    wsUrl: webSocketState.wsUrl,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketActions() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocketActions must be used within a WebSocketProvider");
  }
  return context;
}
