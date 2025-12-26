/**
 * ProjectCommandHandler 测试
 */

import { ProjectCommandHandler } from "@cli/commands/ProjectCommandHandler";
import type { IDIContainer } from "@cli/interfaces/Config";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 测试用的 ProjectCommandHandler 子类，用于访问受保护的方法
 */
class TestableProjectCommandHandler extends ProjectCommandHandler {
  // 暴露受保护的方法供测试使用
  public async testHandleCreate(
    projectName: string,
    options: any
  ): Promise<void> {
    return this.handleCreate(projectName, options);
  }
}

// Mock ora
vi.mock("ora", () => ({
  default: vi.fn().mockImplementation((text) => ({
    start: () => ({
      succeed: (message: string) => {
        console.log(`✅ ${message}`);
      },
      fail: (message: string) => {
        console.log(`✖ ${message}`);
      },
      warn: (message: string) => {
        console.log(`⚠ ${message}`);
      },
    }),
  })),
}));

// Mock chalk
vi.mock("chalk", () => ({
  default: {
    red: (text: string) => text,
    yellow: (text: string) => text,
    gray: (text: string) => text,
    green: (text: string) => text,
    cyan: (text: string) => text,
  },
}));

// Mock services
const mockErrorHandler = {
  handle: vi.fn(),
};

const mockTemplateManager = {
  getAvailableTemplates: vi.fn(),
  validateTemplate: vi.fn(),
  createProject: vi.fn(),
};

const mockFileUtils = {
  exists: vi.fn(),
};

const mockFormatUtils = {
  calculateSimilarity: vi.fn(),
};

const mockContainer = {
  get: vi.fn((name: string) => {
    if (name === "errorHandler") {
      return mockErrorHandler;
    }
    if (name === "templateManager") {
      return mockTemplateManager;
    }
    if (name === "fileUtils") {
      return mockFileUtils;
    }
    if (name === "formatUtils") {
      return mockFormatUtils;
    }
    return undefined;
  }),
} as unknown as IDIContainer;

describe("ProjectCommandHandler", () => {
  let handler: TestableProjectCommandHandler;

  beforeEach(() => {
    handler = new TestableProjectCommandHandler(mockContainer);
    vi.clearAllMocks();
  });

  describe("基本属性", () => {
    it("应该有正确的命令名称", () => {
      expect(handler.name).toBe("create");
    });

    it("应该有正确的命令描述", () => {
      expect(handler.description).toBe("创建项目");
    });

    it("应该有正确的选项配置", () => {
      expect(handler.options).toEqual([
        {
          flags: "-t, --template <templateName>",
          description: "使用指定模板创建项目",
        },
      ]);
    });
  });

  describe("execute 方法", () => {
    it("应该验证参数数量", async () => {
      // 测试参数不足的情况
      await expect(handler.execute([], {})).rejects.toThrow();
    });

    it("应该处理参数数量不足的情况", async () => {
      await expect(handler.execute([], {})).rejects.toThrow();
    });

    it("应该正确传递参数给 handleCreate", async () => {
      const projectName = "test-project";
      const options = { template: "basic" };

      // Mock 服务以避免依赖问题
      mockFileUtils.exists.mockResolvedValue(false);
      mockTemplateManager.getAvailableTemplates.mockResolvedValue(["basic"]);
      mockTemplateManager.validateTemplate.mockResolvedValue(true);
      mockTemplateManager.createProject.mockResolvedValue(undefined);

      await handler.execute([projectName], options);

      // 验证 templateManager.createProject 被调用
      expect(mockTemplateManager.createProject).toHaveBeenCalledWith({
        templateName: "basic",
        targetPath: expect.any(String),
        projectName: "test-project",
      });
    });
  });

  describe("handleCreate 方法", () => {
    it("应该创建基本项目（无模板）", async () => {
      const projectName = "basic-project";
      const options = {};

      // Mock 服务
      mockFileUtils.exists.mockResolvedValue(false);
      mockTemplateManager.createProject.mockResolvedValue(undefined);

      await handler.testHandleCreate(projectName, options);

      expect(mockTemplateManager.createProject).toHaveBeenCalledWith({
        templateName: null,
        targetPath: expect.any(String),
        projectName: "basic-project",
      });
    });

    it("应该处理项目目录已存在的情况", async () => {
      const projectName = "existing-project";
      const options = {};

      // Mock 服务：目录已存在
      mockFileUtils.exists.mockResolvedValue(true);

      await handler.testHandleCreate(projectName, options);

      // 验证没有调用 createProject
      expect(mockTemplateManager.createProject).not.toHaveBeenCalled();
    });

    it("应该处理使用模板创建项目", async () => {
      const projectName = "template-project";
      const options = { template: "react" };

      // Mock 服务
      mockFileUtils.exists.mockResolvedValue(false);
      mockTemplateManager.getAvailableTemplates.mockResolvedValue(["react"]);
      mockTemplateManager.validateTemplate.mockResolvedValue(true);
      mockTemplateManager.createProject.mockResolvedValue(undefined);

      await handler.testHandleCreate(projectName, options);

      expect(mockTemplateManager.createProject).toHaveBeenCalledWith({
        templateName: "react",
        targetPath: expect.any(String),
        projectName: "template-project",
      });
    });

    it("应该处理模板不存在的情况", async () => {
      const projectName = "invalid-template-project";
      const options = { template: "non-existent" };

      // Mock 服务
      mockFileUtils.exists.mockResolvedValue(false);
      mockTemplateManager.getAvailableTemplates.mockResolvedValue([
        "react",
        "vue",
      ]);
      mockTemplateManager.validateTemplate.mockResolvedValue(false);
      mockFormatUtils.calculateSimilarity.mockReturnValue(0.3);

      await handler.testHandleCreate(projectName, options);

      // 验证没有调用 createProject
      expect(mockTemplateManager.createProject).not.toHaveBeenCalled();
    });

    it("应该处理模板验证错误", async () => {
      const projectName = "error-project";
      const options = { template: "react" };
      const error = new Error("模板验证失败");

      // Mock 服务
      mockFileUtils.exists.mockResolvedValue(false);
      mockTemplateManager.getAvailableTemplates.mockResolvedValue(["react"]);
      mockTemplateManager.validateTemplate.mockRejectedValue(error);

      await handler.testHandleCreate(projectName, options);

      // 验证错误处理
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(error);
    });
  });
});
