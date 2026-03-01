import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
/**
 * 提示词解析工具单元测试
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultSystemPrompt, resolvePrompt } from "../prompt-utils";

// Mock configManager
vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    getConfigPath: vi.fn(() => "/test/config/xiaozhi.config.json"),
  },
}));

// Mock fs module
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe("prompt-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("getDefaultSystemPrompt", () => {
    it("应该返回默认系统提示词", () => {
      const prompt = getDefaultSystemPrompt();
      expect(prompt).toBe(
        "你是一个友好的语音助手，请用简洁的中文回答用户的问题。"
      );
    });
  });

  describe("resolvePrompt", () => {
    describe("未配置或空字符串", () => {
      it("未配置 prompt 时应返回默认提示词", () => {
        const result = resolvePrompt(undefined);
        expect(result).toBe(getDefaultSystemPrompt());
      });

      it("空字符串 prompt 时应返回默认提示词", () => {
        const result = resolvePrompt("");
        expect(result).toBe(getDefaultSystemPrompt());
      });

      it("仅包含空格的字符串应返回默认提示词", () => {
        const result = resolvePrompt("   ");
        expect(result).toBe(getDefaultSystemPrompt());
      });
    });

    describe("纯字符串 prompt", () => {
      it("纯字符串 prompt 应直接返回", () => {
        const customPrompt = "这是一个自定义的提示词";
        const result = resolvePrompt(customPrompt);
        expect(result).toBe(customPrompt);
      });

      it("以 `.` 开头但不是路径的字符串应直接返回", () => {
        const customPrompt = ".hidden prompt 内容";
        const result = resolvePrompt(customPrompt);
        expect(result).toBe(customPrompt);
      });

      it("多行文本应直接返回", () => {
        const customPrompt = "第一行\n第二行\n第三行";
        const result = resolvePrompt(customPrompt);
        expect(result).toBe(customPrompt);
      });
    });

    describe("绝对路径文件", () => {
      it("绝对路径文件存在时应读取文件内容", () => {
        const filePath = "/absolute/path/to/prompt.md";
        const fileContent = "这是文件中的提示词内容";

        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(readFileSync).mockReturnValue(fileContent);

        const result = resolvePrompt(filePath);

        expect(existsSync).toHaveBeenCalledWith(filePath);
        expect(readFileSync).toHaveBeenCalledWith(filePath, "utf-8");
        expect(result).toBe(fileContent);
      });

      it("绝对路径文件不存在时应返回默认提示词", () => {
        const filePath = "/absolute/path/to/nonexistent.md";

        vi.mocked(existsSync).mockReturnValue(false);

        const result = resolvePrompt(filePath);

        expect(existsSync).toHaveBeenCalledWith(filePath);
        expect(result).toBe(getDefaultSystemPrompt());
      });

      it("文件读取失败时应返回默认提示词", () => {
        const filePath = "/absolute/path/to/prompt.md";

        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(readFileSync).mockImplementation(() => {
          throw new Error("读取失败");
        });

        const result = resolvePrompt(filePath);

        expect(result).toBe(getDefaultSystemPrompt());
      });

      it("文件内容为空时应返回默认提示词", () => {
        const filePath = "/absolute/path/to/empty.md";

        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(readFileSync).mockReturnValue("");

        const result = resolvePrompt(filePath);

        expect(result).toBe(getDefaultSystemPrompt());
      });

      it("文件内容仅包含空白字符时应返回默认提示词", () => {
        const filePath = "/absolute/path/to/whitespace.md";

        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(readFileSync).mockReturnValue("   \n\t  ");

        const result = resolvePrompt(filePath);

        expect(result).toBe(getDefaultSystemPrompt());
      });
    });

    describe("相对路径文件", () => {
      it("相对路径 `./` 文件存在时应正确解析并读取", () => {
        const relativePath = "./prompts/default.md";
        const expectedAbsolutePath = resolve(
          "/test/config",
          "prompts/default.md"
        );
        const fileContent = "相对路径文件内容";

        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(readFileSync).mockReturnValue(fileContent);

        const result = resolvePrompt(relativePath);

        expect(existsSync).toHaveBeenCalledWith(expectedAbsolutePath);
        expect(readFileSync).toHaveBeenCalledWith(
          expectedAbsolutePath,
          "utf-8"
        );
        expect(result).toBe(fileContent);
      });

      it("相对路径 `../` 文件存在时应正确解析并读取", () => {
        const relativePath = "../prompts/parent.md";
        const expectedAbsolutePath = resolve(
          "/test/config",
          "../prompts/parent.md"
        );
        const fileContent = "上级目录文件内容";

        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(readFileSync).mockReturnValue(fileContent);

        const result = resolvePrompt(relativePath);

        expect(existsSync).toHaveBeenCalledWith(expectedAbsolutePath);
        expect(result).toBe(fileContent);
      });

      it("相对路径文件不存在时应返回默认提示词", () => {
        const relativePath = "./prompts/nonexistent.md";

        vi.mocked(existsSync).mockReturnValue(false);

        const result = resolvePrompt(relativePath);

        expect(result).toBe(getDefaultSystemPrompt());
      });
    });

    describe("Windows 路径兼容性", () => {
      it("Windows 相对路径 `.\\` 应被正确识别", () => {
        const relativePath = ".\\prompts\\default.md";
        const expectedAbsolutePath = resolve(
          "/test/config",
          "prompts/default.md"
        );
        const fileContent = "Windows 相对路径内容";

        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(readFileSync).mockReturnValue(fileContent);

        const result = resolvePrompt(relativePath);

        expect(existsSync).toHaveBeenCalledWith(expectedAbsolutePath);
        expect(result).toBe(fileContent);
      });

      it("Windows 相对路径 `..\\` 应被正确识别", () => {
        const relativePath = "..\\prompts\\parent.md";
        const expectedAbsolutePath = resolve(
          "/test/config",
          "../prompts/parent.md"
        );
        const fileContent = "Windows 上级目录内容";

        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(readFileSync).mockReturnValue(fileContent);

        const result = resolvePrompt(relativePath);

        expect(existsSync).toHaveBeenCalledWith(expectedAbsolutePath);
        expect(result).toBe(fileContent);
      });

      it("混合路径分隔符应被正确处理", () => {
        const relativePath = ".\\prompts/subfolder\\prompt.md";
        const expectedAbsolutePath = resolve(
          "/test/config",
          "prompts/subfolder/prompt.md"
        );
        const fileContent = "混合分隔符路径内容";

        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(readFileSync).mockReturnValue(fileContent);

        const result = resolvePrompt(relativePath);

        expect(existsSync).toHaveBeenCalledWith(expectedAbsolutePath);
        expect(result).toBe(fileContent);
      });
    });

    describe("边界情况", () => {
      it("包含特殊字符的路径应正确处理", () => {
        const filePath = "/path/with spaces/提示词.md";
        const fileContent = "特殊字符路径内容";

        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(readFileSync).mockReturnValue(fileContent);

        const result = resolvePrompt(filePath);

        expect(existsSync).toHaveBeenCalledWith(filePath);
        expect(result).toBe(fileContent);
      });

      it("Markdown 格式的提示词文件应正确读取", () => {
        const filePath = "/path/to/prompt.md";
        const fileContent =
          "# 系统提示词\n\n你是一个 AI 助手。\n\n## 规则\n1. 简洁回答";

        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(readFileSync).mockReturnValue(fileContent);

        const result = resolvePrompt(filePath);

        expect(result).toBe(fileContent);
      });
    });
  });
});
