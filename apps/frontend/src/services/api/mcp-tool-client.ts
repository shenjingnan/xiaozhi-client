/**
 * MCP 工具管理 API 客户端
 * 负责 MCP 工具的启用、禁用、状态查询和列表管理
 */

import { BaseClient, type ApiResponse } from "./base-client";

/**
 * MCP 工具管理操作类型
 */
type MCPToolManageAction = "enable" | "disable" | "status" | "toggle";

/**
 * MCP 工具管理请求接口
 */
interface MCPToolManageRequest {
	action: MCPToolManageAction;
	serverName: string;
	toolName: string;
	description?: string;
}

/**
 * MCP 工具管理响应接口
 */
interface MCPToolManageResponse {
	serverName: string;
	toolName: string;
	enabled: boolean;
	description?: string;
	usageCount?: number;
	lastUsedTime?: string;
}

/**
 * MCP 工具列表请求接口
 */
interface MCPToolListRequest {
	serverName?: string;
	includeUsageStats?: boolean;
}

/**
 * MCP 工具列表响应接口
 */
interface MCPToolListResponse {
	serverName?: string;
	tools: Array<{
		toolName: string;
		enabled: boolean;
		description?: string;
		usageCount?: number;
		lastUsedTime?: string;
	}>;
	total: number;
	enabledCount: number;
	disabledCount: number;
}

/**
 * MCP 工具管理客户端类
 */
export class MCPToolClient extends BaseClient {
	// ==================== MCP 工具管理 API ====================

	/**
	 * 管理 MCP 工具（启用/禁用/查询状态/切换）
	 * POST /api/tools/mcp/manage
	 * @param request 管理请求
	 * @returns 工具状态信息
	 */
	async manageMCPTool(
		request: MCPToolManageRequest
	): Promise<MCPToolManageResponse> {
		const response: ApiResponse<MCPToolManageResponse> = await this.request(
			"/api/tools/mcp/manage",
			{
				method: "POST",
				body: JSON.stringify(request),
			}
		);

		if (!response.success || !response.data) {
			throw new Error(response.error?.message || "MCP 工具管理操作失败");
		}

		return response.data;
	}

	/**
	 * 获取 MCP 工具列表
	 * POST /api/tools/mcp/list
	 * @param request 列表请求（可选）
	 * @returns 工具列表信息
	 */
	async listMCPTools(request?: MCPToolListRequest): Promise<MCPToolListResponse> {
		const response: ApiResponse<MCPToolListResponse> = await this.request(
			"/api/tools/mcp/list",
			{
				method: "POST",
				body: JSON.stringify(request || {}),
			}
		);

		if (!response.success || !response.data) {
			throw new Error(response.error?.message || "获取 MCP 工具列表失败");
		}

		return response.data;
	}
}