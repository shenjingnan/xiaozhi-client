/**
 * 传输层抽象模块导出
 * 阶段二重构：传输层抽象的统一入口
 */

// 抽象基类和接口
export {
  TransportAdapter,
  ConnectionState,
  type MCPMessage,
  type MCPResponse,
  type MCPError,
  type TransportConfig,
} from "./TransportAdapter.js";

// 具体实现
export { StdioAdapter, type StdioConfig } from "./StdioAdapter.js";
export { HTTPAdapter, type HTTPConfig } from "./HTTPAdapter.js";

// 验证工具
export {
  verifyTransportLayer,
  verifyHTTPAdapter,
  verifyStdioAdapter,
} from "./verify-transport-layer.js";

/**
 * 传输层抽象使用指南
 *
 * ## 基本用法
 *
 * ```typescript
 * import { HTTPAdapter, StdioAdapter } from './transports';
 * import { MCPMessageHandler } from './core/MCPMessageHandler';
 * import { MCPServiceManager } from './services/MCPServiceManager';
 *
 * // 初始化核心组件
 * const serviceManager = new MCPServiceManager();
 * const messageHandler = new MCPMessageHandler(serviceManager);
 *
 * // 创建 HTTP 适配器
 * const httpAdapter = new HTTPAdapter(messageHandler, {
 *   name: 'http-server',
 *   port: 3000,
 *   host: 'localhost',
 * });
 *
 * // 启动适配器
 * await httpAdapter.initialize();
 * await httpAdapter.start();
 *
 * // 创建 Stdio 适配器
 * const stdinAdapter = new StdioAdapter(messageHandler, {
 *   name: 'stdio-server',
 *   encoding: 'utf8',
 * });
 *
 * await stdinAdapter.initialize();
 * await stdinAdapter.start();
 * ```
 *
 * ## 扩展新的传输协议
 *
 * ```typescript
 * import { TransportAdapter, ConnectionState } from './transports';
 *
 * class WebSocketAdapter extends TransportAdapter {
 *   async initialize(): Promise<void> {
 *     // 初始化 WebSocket 服务器
 *     this.setState(ConnectionState.CONNECTING);
 *   }
 *
 *   async start(): Promise<void> {
 *     // 启动 WebSocket 服务器
 *     this.setState(ConnectionState.CONNECTED);
 *   }
 *
 *   async stop(): Promise<void> {
 *     // 停止 WebSocket 服务器
 *     this.setState(ConnectionState.DISCONNECTED);
 *   }
 *
 *   async sendMessage(message: MCPMessage | MCPResponse): Promise<void> {
 *     // 发送消息到 WebSocket 客户端
 *   }
 * }
 * ```
 *
 * ## 架构优势
 *
 * 1. **统一接口**：所有传输协议都实现相同的抽象接口
 * 2. **可扩展性**：轻松添加新的传输协议支持
 * 3. **代码复用**：消息处理逻辑统一，减少重复代码
 * 4. **类型安全**：完整的 TypeScript 类型定义
 * 5. **错误处理**：统一的错误处理和日志记录
 * 6. **状态管理**：标准化的连接状态管理
 * 7. **配置灵活**：支持灵活的配置选项
 *
 * ## 性能特点
 *
 * - **轻量级抽象**：最小化性能开销
 * - **异步处理**：全面支持异步操作
 * - **内存优化**：合理的缓冲区管理
 * - **连接管理**：高效的连接生命周期管理
 */
