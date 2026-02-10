/**
 * 处理器类型定义
 * 独立于 handlers 实现以避免循环依赖
 *
 * 此文件定义了所有处理器相关的接口类型，但不依赖具体的处理器实现。
 * 这样可以打破 types/hono.context.ts → routes/index.ts → handlers/ 之间的循环依赖。
 */

/**
 * 端点处理器接口
 * 端点处理器的类型定义，不依赖具体实现
 * 使用 extends Record 来支持任意方法签名
 */
export interface EndpointHandler extends Record<string, any> {}

/**
 * 配置管理处理器接口
 */
export interface ConfigApiHandler extends Record<string, any> {}

/**
 * 状态查询处理器接口
 */
export interface StatusApiHandler extends Record<string, any> {}

/**
 * 服务管理处理器接口
 */
export interface ServiceApiHandler extends Record<string, any> {}

/**
 * MCP 工具处理器接口
 */
export interface MCPToolHandler extends Record<string, any> {}

/**
 * 工具调用日志处理器接口
 */
export interface MCPToolLogHandler extends Record<string, any> {}

/**
 * 版本信息处理器接口
 */
export interface VersionApiHandler extends Record<string, any> {}

/**
 * 静态文件处理器接口
 */
export interface StaticFileHandler extends Record<string, any> {}

/**
 * MCP 路由处理器接口
 */
export interface MCPRouteHandler extends Record<string, any> {}

/**
 * MCP 服务器管理处理器接口
 */
export interface MCPHandler extends Record<string, any> {}

/**
 * 更新管理处理器接口
 */
export interface UpdateApiHandler extends Record<string, any> {}

/**
 * 扣子 API 处理器接口
 */
export interface CozeHandler extends Record<string, any> {}

/**
 * 处理器依赖接口
 * 定义路由系统需要的所有处理器依赖
 */
export interface HandlerDependencies {
  /** 配置管理处理器 */
  configApiHandler: ConfigApiHandler;
  /** 状态查询处理器 */
  statusApiHandler: StatusApiHandler;
  /** 服务管理处理器 */
  serviceApiHandler: ServiceApiHandler;
  /** MCP 工具处理器 */
  mcpToolHandler: MCPToolHandler;
  /** 工具调用日志处理器 */
  mcpToolLogHandler: MCPToolLogHandler;
  /** 版本信息处理器 */
  versionApiHandler: VersionApiHandler;
  /** 静态文件处理器 */
  staticFileHandler: StaticFileHandler;
  /** MCP 路由处理器 */
  mcpRouteHandler: MCPRouteHandler;
  /** MCP 服务器管理处理器（可选） */
  mcpHandler?: MCPHandler;
  /** 更新管理处理器 */
  updateApiHandler: UpdateApiHandler;
  /** 扣子 API 处理器 */
  cozeHandler: CozeHandler;
  /** 小智接入点处理器（通过中间件动态注入） */
  endpointHandler?: EndpointHandler;
}
