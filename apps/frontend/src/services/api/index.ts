/**
 * API 客户端模块统一导出
 * 提供多个职责单一的客户端类和组合式 ApiClient
 */

import { ConfigClient, type PromptFileInfo } from "./config-client.js";
import { StatusClient, type RestartStatus, type FullStatus } from "./status-client.js";
import { ToolClient, type CustomMCPTool, type AddedToolResponse } from "./tool-client.js";
import { ServiceClient, type ServiceStatus, type ServiceHealth } from "./service-client.js";
import { VersionClient, type VersionInfo } from "./version-client.js";
import { EndpointClient, type EndpointStatusResponse } from "./endpoint-client.js";
import { MCPServerClient } from "./mcp-server-client.js";
import { MCPToolClient } from "./mcp-tool-client.js";

// 导出各个专用客户端类
export {
	ConfigClient,
	StatusClient,
	ToolClient,
	ServiceClient,
	VersionClient,
	EndpointClient,
	MCPServerClient,
	MCPToolClient,
};

// 导出类型定义
export type {
	PromptFileInfo,
	RestartStatus,
	FullStatus,
	CustomMCPTool,
	AddedToolResponse,
	ServiceStatus,
	ServiceHealth,
	VersionInfo,
	EndpointStatusResponse,
};

/**
 * 组合式 API 客户端类
 * 提供向后兼容的统一接口，组合所有专用客户端
 */
export class ApiClient {
	private configClient: ConfigClient;
	private statusClient: StatusClient;
	private toolClient: ToolClient;
	private serviceClient: ServiceClient;
	private versionClient: VersionClient;
	private endpointClient: EndpointClient;
	private mcpServerClient: MCPServerClient;
	private mcpToolClient: MCPToolClient;

	constructor(baseUrl?: string) {
		this.configClient = new ConfigClient(baseUrl);
		this.statusClient = new StatusClient(baseUrl);
		this.toolClient = new ToolClient(baseUrl);
		this.serviceClient = new ServiceClient(baseUrl);
		this.versionClient = new VersionClient(baseUrl);
		this.endpointClient = new EndpointClient(baseUrl);
		this.mcpServerClient = new MCPServerClient(baseUrl);
		this.mcpToolClient = new MCPToolClient(baseUrl);
	}

	// ==================== 配置管理 API ====================

	async getConfig() {
		return this.configClient.getConfig();
	}

	async updateConfig(config: Parameters<ConfigClient["updateConfig"]>[0]) {
		return this.configClient.updateConfig(config);
	}

	async getMcpEndpoint() {
		return this.configClient.getMcpEndpoint();
	}

	async getMcpEndpoints() {
		return this.configClient.getMcpEndpoints();
	}

	async getMcpServers() {
		return this.configClient.getMcpServers();
	}

	async getConnectionConfig() {
		return this.configClient.getConnectionConfig();
	}

	async reloadConfig() {
		return this.configClient.reloadConfig();
	}

	async getConfigPath() {
		return this.configClient.getConfigPath();
	}

	async checkConfigExists() {
		return this.configClient.checkConfigExists();
	}

	async getPromptFiles() {
		return this.configClient.getPromptFiles();
	}

	async getPromptFileContent(
		path: Parameters<ConfigClient["getPromptFileContent"]>[0]
	) {
		return this.configClient.getPromptFileContent(path);
	}

	async updatePromptFileContent(
		path: Parameters<ConfigClient["updatePromptFileContent"]>[0],
		content: Parameters<ConfigClient["updatePromptFileContent"]>[1]
	) {
		return this.configClient.updatePromptFileContent(path, content);
	}

	async createPromptFile(
		fileName: Parameters<ConfigClient["createPromptFile"]>[0],
		content: Parameters<ConfigClient["createPromptFile"]>[1]
	) {
		return this.configClient.createPromptFile(fileName, content);
	}

	async deletePromptFile(path: Parameters<ConfigClient["deletePromptFile"]>[0]) {
		return this.configClient.deletePromptFile(path);
	}

	// ==================== 状态管理 API ====================

	async getStatus() {
		return this.statusClient.getStatus();
	}

	async getClientStatus() {
		return this.statusClient.getClientStatus();
	}

	async getRestartStatus() {
		return this.statusClient.getRestartStatus();
	}

	async checkClientConnected() {
		return this.statusClient.checkClientConnected();
	}

	async getLastHeartbeat() {
		return this.statusClient.getLastHeartbeat();
	}

	async getActiveMCPServers() {
		return this.statusClient.getActiveMCPServers();
	}

	async updateClientStatus(
		status: Parameters<StatusClient["updateClientStatus"]>[0]
	) {
		return this.statusClient.updateClientStatus(status);
	}

	async setActiveMCPServers(
		servers: Parameters<StatusClient["setActiveMCPServers"]>[0]
	) {
		return this.statusClient.setActiveMCPServers(servers);
	}

	async resetStatus() {
		return this.statusClient.resetStatus();
	}

	// ==================== 工具管理 API ====================

	/**
	 * 添加自定义工具
	 * 支持新的类型化格式和向后兼容的旧格式
	 */
	async addCustomTool(
		workflow: unknown,
		customName?: string,
		customDescription?: string,
		parameterConfig?: unknown
	): Promise<AddedToolResponse>;

	/**
	 * 添加自定义工具（新格式）
	 * 支持多种工具类型：MCP 工具、Coze 工作流等
	 */
	async addCustomTool(request: {
		type: "mcp" | "coze" | "http" | "function";
		data: unknown;
	}): Promise<AddedToolResponse>;

	async addCustomTool(
		param1: unknown,
		customName?: string,
		customDescription?: string,
		parameterConfig?: unknown
	): Promise<AddedToolResponse> {
		return this.toolClient.addCustomTool(
			param1,
			customName,
			customDescription,
			parameterConfig
		);
	}

	async updateCustomTool(
		toolName: string,
		updateRequest: {
			type: "mcp" | "coze" | "http" | "function";
			data: unknown;
		}
	): Promise<unknown> {
		return this.toolClient.updateCustomTool(toolName, updateRequest);
	}

	async removeCustomTool(toolName: Parameters<ToolClient["removeCustomTool"]>[0]) {
		return this.toolClient.removeCustomTool(toolName);
	}

	async getCustomTools() {
		return this.toolClient.getCustomTools();
	}

	async getToolsList(
		status?: Parameters<ToolClient["getToolsList"]>[0],
		sortConfig?: Parameters<ToolClient["getToolsList"]>[1]
	) {
		return this.toolClient.getToolsList(status, sortConfig);
	}

	// ==================== 服务控制 API ====================

	async restartService() {
		return this.serviceClient.restartService();
	}

	async stopService() {
		return this.serviceClient.stopService();
	}

	async startService() {
		return this.serviceClient.startService();
	}

	async getServiceStatus() {
		return this.serviceClient.getServiceStatus();
	}

	async getServiceHealth() {
		return this.serviceClient.getServiceHealth();
	}

	// ==================== 版本信息 API ====================

	async getTTSVoices() {
		return this.versionClient.getTTSVoices();
	}

	async getVersion() {
		return this.versionClient.getVersion();
	}

	async getVersionSimple() {
		return this.versionClient.getVersionSimple();
	}

	async getAvailableVersions(
		type?: Parameters<VersionClient["getAvailableVersions"]>[0]
	) {
		return this.versionClient.getAvailableVersions(type);
	}

	async getLatestVersion() {
		return this.versionClient.getLatestVersion();
	}

	async clearVersionCache() {
		return this.versionClient.clearVersionCache();
	}

	async updateVersion(version: Parameters<VersionClient["updateVersion"]>[0]) {
		return this.versionClient.updateVersion(version);
	}

	// ==================== 端点管理 API ====================

	async getEndpointStatus(endpoint: Parameters<EndpointClient["getEndpointStatus"]>[0]) {
		return this.endpointClient.getEndpointStatus(endpoint);
	}

	async connectEndpoint(endpoint: Parameters<EndpointClient["connectEndpoint"]>[0]) {
		return this.endpointClient.connectEndpoint(endpoint);
	}

	async disconnectEndpoint(
		endpoint: Parameters<EndpointClient["disconnectEndpoint"]>[0]
	) {
		return this.endpointClient.disconnectEndpoint(endpoint);
	}

	async reconnectEndpoint(
		endpoint: Parameters<EndpointClient["reconnectEndpoint"]>[0]
	) {
		return this.endpointClient.reconnectEndpoint(endpoint);
	}

	async addEndpoint(endpoint: Parameters<EndpointClient["addEndpoint"]>[0]) {
		return this.endpointClient.addEndpoint(endpoint);
	}

	async removeEndpoint(endpoint: Parameters<EndpointClient["removeEndpoint"]>[0]) {
		return this.endpointClient.removeEndpoint(endpoint);
	}

	// ==================== MCP 服务器管理 API ====================

	async addMCPServer(
		name: Parameters<MCPServerClient["addMCPServer"]>[0],
		config: Parameters<MCPServerClient["addMCPServer"]>[1]
	) {
		return this.mcpServerClient.addMCPServer(name, config);
	}

	async removeMCPServer(
		serverName: Parameters<MCPServerClient["removeMCPServer"]>[0]
	) {
		return this.mcpServerClient.removeMCPServer(serverName);
	}

	async getMCPServerStatus(
		serverName: Parameters<MCPServerClient["getMCPServerStatus"]>[0]
	) {
		return this.mcpServerClient.getMCPServerStatus(serverName);
	}

	async listMCPServers() {
		return this.mcpServerClient.listMCPServers();
	}

	async checkMCPServerExists(
		serverName: Parameters<MCPServerClient["checkMCPServerExists"]>[0]
	) {
		return this.mcpServerClient.checkMCPServerExists(serverName);
	}

	async updateMCPServer(
		serverName: Parameters<MCPServerClient["updateMCPServer"]>[0],
		config: Parameters<MCPServerClient["updateMCPServer"]>[1]
	) {
		return this.mcpServerClient.updateMCPServer(serverName, config);
	}

	async callTool(
		serviceName: Parameters<MCPServerClient["callTool"]>[0],
		toolName: Parameters<MCPServerClient["callTool"]>[1],
		args?: Parameters<MCPServerClient["callTool"]>[2]
	) {
		return this.mcpServerClient.callTool(serviceName, toolName, args);
	}

	async restartMCPServer(
		serverName: Parameters<MCPServerClient["restartMCPServer"]>[0]
	) {
		return this.mcpServerClient.restartMCPServer(serverName);
	}

	// ==================== MCP 工具管理 API ====================

	async manageMCPTool(
		request: Parameters<MCPToolClient["manageMCPTool"]>[0]
	): ReturnType<MCPToolClient["manageMCPTool"]> {
		return this.mcpToolClient.manageMCPTool(request);
	}

	async listMCPTools(request?: Parameters<MCPToolClient["listMCPTools"]>[0]) {
		return this.mcpToolClient.listMCPTools(request);
	}

	// ==================== 访问器方法 ====================

	/**
	 * 获取配置管理客户端
	 */
	get config() {
		return this.configClient;
	}

	/**
	 * 获取状态管理客户端
	 */
	get status() {
		return this.statusClient;
	}

	/**
	 * 获取工具管理客户端
	 */
	get tool() {
		return this.toolClient;
	}

	/**
	 * 获取服务控制客户端
	 */
	get service() {
		return this.serviceClient;
	}

	/**
	 * 获取版本信息客户端
	 */
	get version() {
		return this.versionClient;
	}

	/**
	 * 获取端点管理客户端
	 */
	get endpoint() {
		return this.endpointClient;
	}

	/**
	 * 获取 MCP 服务器管理客户端
	 */
	get mcpServer() {
		return this.mcpServerClient;
	}

	/**
	 * 获取 MCP 工具管理客户端
	 */
	get mcpTool() {
		return this.mcpToolClient;
	}
}

/**
 * 创建 API 客户端工厂函数
 * 允许创建独立的专用客户端实例
 */
export const createApiClients = (baseUrl?: string) => ({
	config: new ConfigClient(baseUrl),
	status: new StatusClient(baseUrl),
	tool: new ToolClient(baseUrl),
	service: new ServiceClient(baseUrl),
	version: new VersionClient(baseUrl),
	endpoint: new EndpointClient(baseUrl),
	mcpServer: new MCPServerClient(baseUrl),
	mcpTool: new MCPToolClient(baseUrl),
});

/**
 * 创建默认的 API 客户端实例
 */
export const apiClient = new ApiClient();

// 导出共享类型（向后兼容）
export type {
	ApiErrorResponse,
	ApiSuccessResponse,
	AppConfig,
	ClientStatus,
	CustomMCPToolWithStats,
	MCPErrorCode,
	MCPServerAddRequest,
	MCPServerConfig,
	MCPServerStatus,
	MCPServerListResponse,
	VoicesResponse,
} from "@xiaozhi-client/shared-types";