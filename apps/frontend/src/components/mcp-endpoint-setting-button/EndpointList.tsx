import { BadgeInfoIcon } from "lucide-react";
import { EndpointItem } from "./EndpointItem";
import type { EndpointOperationCallbacks, EndpointState } from "./types";

/**
 * 接入点列表组件
 * 显示所有接入点或空状态提示
 */
export function EndpointList({
  endpoints,
  endpointStates,
  callbacks,
}: {
  endpoints: string[];
  endpointStates: Record<string, EndpointState>;
  callbacks: EndpointOperationCallbacks;
}) {
  if (endpoints.length === 0) {
    return (
      <div className="flex flex-col items-center flex-1 text-sm text-muted-foreground text-center justify-center gap-2">
        <BadgeInfoIcon />
        <span>暂无接入点，请添加</span>
      </div>
    );
  }

  return (
    <>
      {endpoints.map((endpoint) => (
        <EndpointItem
          key={endpoint}
          endpoint={endpoint}
          state={endpointStates[endpoint]}
          callbacks={callbacks}
        />
      ))}
    </>
  );
}
