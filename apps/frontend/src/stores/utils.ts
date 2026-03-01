/**
 * Zustand Store 共享工具函数
 *
 * 提供 Store 之间共享的通用功能，避免代码重复
 */

/**
 * 基础加载状态接口
 */
export interface LoadingState {
  isLoading: boolean;
  lastUpdated: number | null;
  lastError: Error | null;
}

/**
 * 创建 setLoading 和 setError 方法的工厂函数
 *
 * @param set - Zustand 的 set 函数
 * @returns 包含 setLoading 和 setError 方法的对象
 *
 * @example
 * ```typescript
 * const store = create<Store>()((set) => ({
 *   loading: initialLoadingState,
 *   ...createLoadingActions<Store>(set),
 * }));
 * ```
 *
 * @note 使用 any 类型以兼容 Zustand 的复杂 set 函数签名
 */
export function createLoadingActions<S extends { loading: LoadingState }>(
  set: any
) {
  return {
    /**
     * 更新加载状态
     * @param loading - 部分加载状态更新
     */
    setLoading: (loading: Partial<S["loading"]>) => {
      set(
        (state: S) => ({
          loading: { ...state.loading, ...loading },
        }),
        false,
        "setLoading"
      );
    },

    /**
     * 设置错误信息
     * @param error - 错误对象，null 表示清除错误
     */
    setError: (error: Error | null) => {
      set(
        (state: S) => ({
          loading: { ...state.loading, lastError: error },
        }),
        false,
        "setError"
      );
    },
  };
}
