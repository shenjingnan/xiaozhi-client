import { EndpointStatusBadge } from "./EndpointStatusBadge";
import { EndpointActions } from "./EndpointActions";
import type { EndpointItemProps } from "./types";

/**
 * 切片显示接入点地址
 */
const sliceEndpoint = (endpoint: string) => {
  return `${endpoint.slice(0, 30)}...${endpoint.slice(-10)}`;
};

/**
 * 接入点项组件
 * 显示单个接入点的信息和操作按钮
 */
export function EndpointItem({ endpoint, state, callbacks }: EndpointItemProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-50 rounded-md font-mono gap-3 transition-all duration-200 hover:bg-slate-100">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
        <span className="flex-1 text-ellipsis overflow-hidden whitespace-nowrap text-sm sm:text-base">
          {sliceEndpoint(endpoint)}
        </span>
        <EndpointStatusBadge state={state} />
      </div>
      <EndpointActions endpoint={endpoint} state={state} callbacks={callbacks} />
    </div>
  );
}
