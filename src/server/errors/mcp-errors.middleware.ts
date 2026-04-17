/**
 * MCP 中间件相关的错误定义
 */

/**
 * MCPServiceManager 未初始化错误
 */
export class MCPServiceManagerNotInitializedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MCPServiceManagerNotInitializedError";
  }
}

/**
 * WebServer 不可用错误
 */
export class WebServerNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebServerNotAvailableError";
  }
}
