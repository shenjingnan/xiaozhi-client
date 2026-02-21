/**
 * Backend 模块类型声明
 *
 * 这些声明用于 CLI 包中引用 Backend 模块的类型
 * 避免递归解析 backend 代码，同时提供类型安全
 */

/**
 * WebServer 类型声明
 * 对应 apps/backend/WebServer.ts
 */
declare module "@/WebServer.js" {
	/**
	 * WebServer - Web 服务器主控制器
	 */
	export class WebServer {
		/**
		 * 创建 WebServer 实例
		 * @param port - 可选的端口号，不指定则使用配置文件中的端口
		 */
		constructor(port?: number);

		/**
		 * 启动 Web 服务器
		 */
		start(): Promise<void>;

		/**
		 * 停止 Web 服务器
		 */
		stop(): Promise<void>;

		/**
		 * 销毁 WebServer 实例，清理所有资源
		 */
		destroy(): void;
	}
}
