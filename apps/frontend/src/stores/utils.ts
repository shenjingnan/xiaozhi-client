/**
 * Store 工具函数
 *
 * 提供可复用的状态管理函数，避免在多个 store 中重复实现相同逻辑
 */

import type { NamedSet } from "zustand/middleware";

/**
 * 加载状态接口
 */
export interface LoadingState {
  isLoading?: boolean;
  isUpdating?: boolean;
  isRefreshing?: boolean;
  isRestarting?: boolean;
  lastUpdated?: number | null;
  lastError?: Error | null;
}

/**
 * 创建标准的 loading 和 error 状态管理方法
 *
 * @param set - Zustand 的 set 函数
 * @returns 包含 setLoading 和 setError 方法的对象
 *
 * @example
 * ```typescript
 * import { createLoadingActions } from './utils';
 *
 * export const useMyStore = create<MyStore>()(
 *   devtools((set) => ({
 *     ...initialState,
 *     ...createLoadingActions(set),
 *   }))
 * );
 * ```
 */
export function createLoadingActions<T extends { loading: LoadingState }>(
  set: NamedSet<T>
) {
  return {
    setLoading: (loading: Partial<LoadingState>) => {
      set(
        (state: T) =>
          ({
            loading: { ...state.loading, ...loading },
          }) as Partial<T>,
        false,
        "setLoading"
      );
    },

    setError: (error: Error | null) => {
      set(
        (state: T) =>
          ({
            loading: { ...state.loading, lastError: error },
          }) as Partial<T>,
        false,
        "setError"
      );
    },
  };
}
