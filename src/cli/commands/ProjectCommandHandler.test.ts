/**
 * ProjectCommandHandler 测试
 */

import { describe, expect, it, vi } from "vitest";
import type { IDIContainer } from "../interfaces/Config.js";
import { ProjectCommandHandler } from "./ProjectCommandHandler.js";

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

const mockContainer = {
  get: vi.fn((name: string) => {
    if (name === "errorHandler") {
      return mockErrorHandler;
    }
    return undefined;
  }),
} as unknown as IDIContainer;

describe("ProjectCommandHandler", () => {
  let handler: ProjectCommandHandler;

  beforeEach(() => {
    handler = new ProjectCommandHandler(mockContainer);
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

      // Mock 内部方法以避免依赖问题
      const mockHandleCreate = vi.fn().mockResolvedValue(undefined);
      handler.handleCreate = mockHandleCreate;

      await handler.execute([projectName], options);

      expect(mockHandleCreate).toHaveBeenCalledWith(projectName, options);
    });
  });
});
