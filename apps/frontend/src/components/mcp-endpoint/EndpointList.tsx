import { BadgeInfoIcon } from "lucide-react";
import { EndpointItem } from "./EndpointItem";

interface EndpointListProps {
  endpoints: string[];
  endpointStates: Record<string, {
    connected: boolean;
    isOperating: boolean;
  }>;
  onConnect: (endpoint: string) => void;
  onDisconnect: (endpoint: string) => void;
  onCopy: (endpoint: string) => void;
  onDelete: (endpoint: string) => void;
}

/**
 * 接入点列表组件
 * 显示所有接入点的列表
 */
export function EndpointList({
  endpoints,
  endpointStates,
  onConnect,
  onDisconnect,
  onCopy,
  onDelete,
}: EndpointListProps) {
  if (endpoints.length === 0) {
    return (
      <div className="flex flex-col items-center flex-1 text-sm text-muted-foreground text-center justify-center gap-2">
        <BadgeInfoIcon />
        <span>暂无接入点，请添加</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {endpoints.map((endpoint) => {
        const state = endpointStates[endpoint];
        const isConnected = state?.connected || false;
        const isOperating = state?.isOperating || false;

        return (
          <EndpointItem
            key={endpoint}
            endpoint={endpoint}
            connected={isConnected}
            isOperating={isOperating}
            onConnect={() => onConnect(endpoint)}
            onDisconnect={() => onDisconnect(endpoint)}
            onCopy={() => onCopy(endpoint)}
            onDelete={() => onDelete(endpoint)}
          />
        );
      })}
    </div>
  );
}