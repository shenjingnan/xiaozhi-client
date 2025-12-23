/**
 * 核心库模块统一导出
 */

// endpoint 模块导出
export {
  EndpointConnection,
  EndpointManager,
  XiaozhiConnectionState,
  ToolCallErrorCode,
  ToolCallError,
  type IndependentConnectionOptions,
  type SimpleConnectionStatus,
  type ConnectionStatus,
} from "./endpoint/index.js";

// npm 模块导出
export { NPMManager } from "./npm/index.js";
