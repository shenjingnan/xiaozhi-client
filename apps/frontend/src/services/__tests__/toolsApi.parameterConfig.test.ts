/**
 * ToolsApiService 参数配置功能测试
 * 测试第二阶段新增的参数配置功能
 */

import type { CozeWorkflow, WorkflowParameterConfig } from "@/types/index";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolsApiService } from "../toolsApi";

// Mock apiClient
vi.mock("@services/api", () => ({
  apiClient: {
    addCustomTool: vi.fn(),
    removeCustomTool: vi.fn(),
    getCustomTools: vi.fn(),
  },
}));

import { apiClient } from "@services/api";

describe("ToolsApiService - 参数配置功能", () => {
  let service: ToolsApiService;

  // 测试用的工作流数据
  const mockWorkflow: CozeWorkflow = {
    workflow_id: "7547256178678448138",
    workflow_name: "测试工作流",
    description: "这是一个测试工作流",
    icon_url: "https://example.com/icon.png",
    app_id: "7547221225915809801",
    creator: {
      id: "3871811622675880",
      name: "测试创建者",
    },
    created_at: 1757232517,
    updated_at: 1757232680,
    isAddedAsTool: false,
    toolName: null,
  };

  // 测试用的参数配置
  const mockParameterConfig: WorkflowParameterConfig = {
    parameters: [
      {
        fieldName: "userName",
        description: "用户名称",
        type: "string",
        required: true,
      },
      {
        fieldName: "age",
        description: "用户年龄",
        type: "number",
        required: false,
      },
      {
        fieldName: "isActive",
        description: "是否激活",
        type: "boolean",
        required: true,
      },
    ],
  };

  beforeEach(() => {
    service = new ToolsApiService();
    vi.clearAllMocks();
    vi.mocked(apiClient.addCustomTool).mockResolvedValue({
      name: "test-tool",
      description: "test description",
      inputSchema: {},
      handler: {},
    });
  });

  describe("addCustomTool - 参数配置支持", () => {
    it("应该支持不带参数配置的调用（向后兼容）", async () => {
      await service.addCustomTool(mockWorkflow, "自定义名称", "自定义描述");

      expect(apiClient.addCustomTool).toHaveBeenCalledWith(
        mockWorkflow,
        "自定义名称",
        "自定义描述",
        undefined
      );
    });

    it("应该支持带参数配置的调用", async () => {
      await service.addCustomTool(
        mockWorkflow,
        "自定义名称",
        "自定义描述",
        mockParameterConfig
      );

      expect(apiClient.addCustomTool).toHaveBeenCalledWith(
        mockWorkflow,
        "自定义名称",
        "自定义描述",
        mockParameterConfig
      );
    });

    it("应该支持只传递工作流和参数配置", async () => {
      await service.addCustomTool(
        mockWorkflow,
        undefined,
        undefined,
        mockParameterConfig
      );

      expect(apiClient.addCustomTool).toHaveBeenCalledWith(
        mockWorkflow,
        undefined,
        undefined,
        mockParameterConfig
      );
    });
  });

  describe("validateParameterConfig - 参数配置验证", () => {
    it("应该验证参数配置的基本结构", async () => {
      const invalidConfig = { invalid: "config" } as any;

      await expect(
        service.addCustomTool(mockWorkflow, undefined, undefined, invalidConfig)
      ).rejects.toThrow("参数配置的parameters字段必须是数组");
    });

    it("应该验证参数的字段名格式", async () => {
      const invalidConfig: WorkflowParameterConfig = {
        parameters: [
          {
            fieldName: "123invalid", // 无效的字段名
            description: "测试参数",
            type: "string",
            required: true,
          },
        ],
      };

      await expect(
        service.addCustomTool(mockWorkflow, undefined, undefined, invalidConfig)
      ).rejects.toThrow(
        "字段名格式无效，必须以字母开头，只能包含字母、数字和下划线"
      );
    });

    it("应该验证字段名的唯一性", async () => {
      const duplicateConfig: WorkflowParameterConfig = {
        parameters: [
          {
            fieldName: "duplicateName",
            description: "参数1",
            type: "string",
            required: true,
          },
          {
            fieldName: "duplicateName", // 重复的字段名
            description: "参数2",
            type: "number",
            required: false,
          },
        ],
      };

      await expect(
        service.addCustomTool(
          mockWorkflow,
          undefined,
          undefined,
          duplicateConfig
        )
      ).rejects.toThrow('字段名"duplicateName"重复');
    });

    it("应该验证描述不能为空", async () => {
      const emptyDescConfig: WorkflowParameterConfig = {
        parameters: [
          {
            fieldName: "validName",
            description: "", // 空描述
            type: "string",
            required: true,
          },
        ],
      };

      await expect(
        service.addCustomTool(
          mockWorkflow,
          undefined,
          undefined,
          emptyDescConfig
        )
      ).rejects.toThrow("描述不能为空且必须是字符串");
    });

    it("应该验证描述长度限制", async () => {
      const longDescConfig: WorkflowParameterConfig = {
        parameters: [
          {
            fieldName: "validName",
            description: "a".repeat(201), // 超过200字符
            type: "string",
            required: true,
          },
        ],
      };

      await expect(
        service.addCustomTool(
          mockWorkflow,
          undefined,
          undefined,
          longDescConfig
        )
      ).rejects.toThrow("描述不能超过200个字符");
    });

    it("应该验证参数类型", async () => {
      const invalidTypeConfig: WorkflowParameterConfig = {
        parameters: [
          {
            fieldName: "validName",
            description: "有效描述",
            type: "invalid" as any, // 无效类型
            required: true,
          },
        ],
      };

      await expect(
        service.addCustomTool(
          mockWorkflow,
          undefined,
          undefined,
          invalidTypeConfig
        )
      ).rejects.toThrow("类型必须是string、number或boolean之一");
    });

    it("应该验证required字段类型", async () => {
      const invalidRequiredConfig: WorkflowParameterConfig = {
        parameters: [
          {
            fieldName: "validName",
            description: "有效描述",
            type: "string",
            required: "true" as any, // 应该是布尔值
          },
        ],
      };

      await expect(
        service.addCustomTool(
          mockWorkflow,
          undefined,
          undefined,
          invalidRequiredConfig
        )
      ).rejects.toThrow("required字段必须是布尔值");
    });

    it("应该接受有效的参数配置", async () => {
      // 这个测试应该不抛出异常
      await expect(
        service.addCustomTool(
          mockWorkflow,
          undefined,
          undefined,
          mockParameterConfig
        )
      ).resolves.toBeDefined();

      expect(apiClient.addCustomTool).toHaveBeenCalledWith(
        mockWorkflow,
        undefined,
        undefined,
        mockParameterConfig
      );
    });

    it("应该接受空参数配置", async () => {
      const emptyConfig: WorkflowParameterConfig = {
        parameters: [],
      };

      await expect(
        service.addCustomTool(mockWorkflow, undefined, undefined, emptyConfig)
      ).resolves.toBeDefined();

      expect(apiClient.addCustomTool).toHaveBeenCalledWith(
        mockWorkflow,
        undefined,
        undefined,
        emptyConfig
      );
    });
  });

  describe("向后兼容性", () => {
    it("应该在不传递parameterConfig时正常工作", async () => {
      await service.addCustomTool(mockWorkflow);

      expect(apiClient.addCustomTool).toHaveBeenCalledWith(
        mockWorkflow,
        undefined,
        undefined,
        undefined
      );
    });

    it("应该在传递undefined parameterConfig时正常工作", async () => {
      await service.addCustomTool(mockWorkflow, "名称", "描述", undefined);

      expect(apiClient.addCustomTool).toHaveBeenCalledWith(
        mockWorkflow,
        "名称",
        "描述",
        undefined
      );
    });
  });
});
