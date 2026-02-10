/**
 * 状态 Store 类型定义
 *
 * 包含所有状态相关的接口定义
 */

import type { ClientStatus } from "@xiaozhi-client/shared-types";

/**
 * 重启状态接口
 */
export interface RestartStatus {
  status: "restarting" | "completed" | "failed";
  error?: string;
  timestamp: number;
}

/**
 * 服务状态接口
 */
export interface ServiceStatus {
  running: boolean;
  mode?: string;
  pid?: number;
}

/**
 * 服务健康状态接口
 */
export interface ServiceHealth {
  status: string;
  timestamp: number;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  version: string;
}

/**
 * 完整状态接口
 */
export interface FullStatus {
  client: ClientStatus;
  restart?: RestartStatus;
  timestamp: number;
}

/**
 * 状态加载状态
 */
export interface StatusLoadingState {
  isLoading: boolean;
  isRefreshing: boolean;
  isRestarting: boolean;
  lastUpdated: number | null;
  lastError: Error | null;
}

/**
 * 轮询配置
 */
export interface PollingConfig {
  enabled: boolean;
  interval: number; // 毫秒
  maxRetries: number;
  currentRetries: number;
}

/**
 * 重启轮询配置
 */
export interface RestartPollingConfig {
  enabled: boolean;
  interval: number; // 毫秒，重启检查间隔
  maxAttempts: number; // 最大检查次数
  currentAttempts: number; // 当前检查次数
  timeout: number; // 总超时时间（毫秒）
  startTime: number | null; // 开始时间戳
}

/**
 * 状态来源类型
 */
export type StatusSource = "http" | "websocket" | "polling" | "initial";

/**
 * 状态 Store 状态
 */
export interface StatusState {
  /** 状态数据 */
  clientStatus: ClientStatus | null;
  restartStatus: RestartStatus | null;
  serviceStatus: ServiceStatus | null;
  serviceHealth: ServiceHealth | null;
  fullStatus: FullStatus | null;

  /** 加载状态 */
  loading: StatusLoadingState;

  /** 轮询配置 */
  polling: PollingConfig;

  /** 重启轮询配置 */
  restartPolling: RestartPollingConfig;

  /** 状态来源追踪 */
  lastSource: StatusSource | null;
}

/**
 * 状态 Store 操作方法
 */
export interface StatusActions {
  /** 基础操作 */
  setClientStatus: (status: ClientStatus, source?: StatusSource) => void;
  setRestartStatus: (
    status: RestartStatus | null,
    source?: StatusSource
  ) => void;
  setServiceStatus: (status: ServiceStatus) => void;
  setServiceHealth: (health: ServiceHealth) => void;
  setFullStatus: (status: FullStatus, source?: StatusSource) => void;
  setLoading: (loading: Partial<StatusLoadingState>) => void;
  setError: (error: Error | null) => void;

  /** 异步操作 */
  getStatus: () => Promise<FullStatus>;
  refreshStatus: () => Promise<FullStatus>;
  restartService: () => Promise<void>;
  getServiceStatus: () => Promise<ServiceStatus>;
  getServiceHealth: () => Promise<ServiceHealth>;

  /** 轮询控制 */
  startPolling: (interval?: number) => void;
  stopPolling: () => void;
  setPollingConfig: (config: Partial<PollingConfig>) => void;

  /** 重启轮询控制 */
  startRestartPolling: () => void;
  stopRestartPolling: () => void;
  setRestartPollingConfig: (config: Partial<RestartPollingConfig>) => void;

  /** 工具方法 */
  reset: () => void;
  initialize: () => Promise<void>;
}

/**
 * 完整的状态 Store 接口
 */
export interface StatusStore extends StatusState, StatusActions {}

/**
 * 初始状态
 */
export const initialState: StatusState = {
  clientStatus: null,
  restartStatus: null,
  serviceStatus: null,
  serviceHealth: null,
  fullStatus: null,
  loading: {
    isLoading: false,
    isRefreshing: false,
    isRestarting: false,
    lastUpdated: null,
    lastError: null,
  },
  polling: {
    enabled: false,
    interval: 30000, // 30秒
    maxRetries: 3,
    currentRetries: 0,
  },
  restartPolling: {
    enabled: false,
    interval: 1000, // 1秒检查间隔
    maxAttempts: 60, // 最多检查60次（60秒）
    currentAttempts: 0,
    timeout: 60000, // 60秒总超时
    startTime: null,
  },
  lastSource: null,
};
