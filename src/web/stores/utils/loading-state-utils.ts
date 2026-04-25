/**
 * 加载状态管理工具函数
 *
 * 为 Zustand store 提供通用的 setLoading 和 setError actions，
 * 避免在多个 store 中重复相同的逻辑。
 */

import type { StateCreator } from "zustand";

/**
 * 基础加载状态接口
 */
export interface LoadingStateBase {
  lastError: Error | null;
}

/**
 * 创建 setLoading action
 *
 * @param set - Zustand 的 set 函数
 * @param actionName - 用于 devtools 的 action 名称
 * @returns setLoading action 函数
 */
export function createSetLoadingAction<
  TState extends { loading: LoadingStateBase },
>(
  set: StateCreator<TState> extends (
    partial: (state: TState) => Partial<TState>,
    replace?: boolean | undefined,
    action?: string | { type: unknown } | undefined
  ) => void
    ? (
        partial: (state: TState) => Partial<TState>,
        replace?: boolean | undefined,
        action?: string | { type: unknown } | undefined
      ) => void
    : never,
  actionName = "setLoading"
) {
  return (loading: Partial<TState["loading"]>) => {
    set(
      (state) => ({
        loading: { ...state.loading, ...loading },
      }),
      false,
      actionName
    );
  };
}

/**
 * 创建 setError action
 *
 * @param set - Zustand 的 set 函数
 * @param actionName - 用于 devtools 的 action 名称
 * @returns setError action 函数
 */
export function createSetErrorAction<
  TState extends { loading: LoadingStateBase },
>(
  set: StateCreator<TState> extends (
    partial: (state: TState) => Partial<TState>,
    replace?: boolean | undefined,
    action?: string | { type: unknown } | undefined
  ) => void
    ? (
        partial: (state: TState) => Partial<TState>,
        replace?: boolean | undefined,
        action?: string | { type: unknown } | undefined
      ) => void
    : never,
  actionName = "setError"
) {
  return (error: Error | null) => {
    set(
      (state) => ({
        loading: { ...state.loading, lastError: error },
      }),
      false,
      actionName
    );
  };
}
