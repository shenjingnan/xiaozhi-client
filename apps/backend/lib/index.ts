/**
 * 核心库模块统一导出
 */

// endpoint 模块导出
export {
  ProxyMCPServer,
  IndependentXiaozhiConnectionManager,
  XiaozhiConnectionState,
  type IndependentConnectionOptions,
  type SimpleConnectionStatus,
  type ConnectionStatus,
} from "./endpoint/index.js";
