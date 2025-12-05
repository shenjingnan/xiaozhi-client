/**
 * ProxyMCPServer 重新导出文件
 *
 * 此文件用于向后兼容，将 ProxyMCPServer 从新位置重新导出
 *
 * @deprecated 建议直接从 @endpoint 或 @root/lib/endpoint 导入
 */

export {
  ProxyMCPServer,
  ToolCallErrorCode,
  ToolCallError,
} from "./lib/index.js";
