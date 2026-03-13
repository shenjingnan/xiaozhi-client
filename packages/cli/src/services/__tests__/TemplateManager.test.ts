/**
 * 模板管理服务单元测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileError, ValidationError } from "../../errors/index.js";
import type { TemplateCreateOptions } from "../TemplateManager";
import { TemplateManagerImpl } from "../TemplateManager";

// Mock 依赖
vi.mock("../../utils/PathUtils.js", () => ({
  PathUtils: {
    findTemplatesDir: vi.fn(),
    getTemplatePath: vi.fn(),
  },
}));

vi.mock("../../utils/FileUtils.js", () => ({
  FileUtils: {
    exists: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    ensureDir: vi.fn(),
    copyDirectory: vi.fn(),
    listDirectory: vi.fn(),
  },
}));

vi.mock("../../utils/Validation.js", () => ({
  Validation: {
    validateTemplateName: vi.fn(),
    validateRequired: vi.fn(),
    validateProjectName: vi.fn(),
  },
}));

vi.mock("node:fs", () => ({
  default: {
    readdirSync: vi.fn(),
  },
}));

vi.mock("node:path", () => ({
  default: {
    join: vi.fn((...args) => args.join("/")),
    resolve: vi.fn((p) => `/resolved/${p}`),
    relative: vi.fn((from, to) => {
      // Handle relative path computation
      const fromParts = String(from).split("/").filter(Boolean);
      const toParts = String(to).split("/").filter(Boolean);

      // Find common prefix
      let commonLength = 0;
      for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
        if (fromParts[i] === toParts[i]) {
          commonLength++;
        } else {
          break;
        }
      }

      // Build relative path
      const upSteps = fromParts.length - commonLength;
      const downPath = toParts.slice(commonLength).join("/");

      if (upSteps === 0) {
        return downPath || ".";
      }

      const upPath = Array(upSteps).fill("..").join("/");
      return upPath ? `${upPath}/${downPath}` : downPath;
    }),
    basename: vi.fn((p: string) => {
      const parts = p.split("/");
      return parts[parts.length - 1] || "";
    }),
    sep: "/",
  },
}));

const { PathUtils } = await import("../../utils/PathUtils.js");
const { FileUtils } = await import("../../utils/FileUtils.js");
const { Validation } = await import("../../utils/Validation.js");
const fs = await import("node:fs");

describe("TemplateManagerImpl", () => {
  let templateManager: TemplateManagerImpl;

  beforeEach(() => {
    templateManager = new TemplateManagerImpl();

    // 重置所有 mock
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getAvailableTemplates", () => {
    it("should return empty array if templates directory not found", async () => {
      (PathUtils.findTemplatesDir as any).mockReturnValue(null);

      const templates = await templateManager.getAvailableTemplates();

      expect(templates).toEqual([]);
    });

    it("should return available templates", async () => {
      (PathUtils.findTemplatesDir as any).mockReturnValue("/templates");
      (fs.default.readdirSync as any).mockReturnValue([
        { name: "template1", isDirectory: () => true },
        { name: "template2", isDirectory: () => true },
        { name: "file.txt", isDirectory: () => false },
      ]);
      (PathUtils.getTemplatePath as any).mockImplementation(
        (name: string) => `/templates/${name}`
      );
      (FileUtils.exists as any).mockReturnValue(false); // No template.json
      (FileUtils.listDirectory as any).mockReturnValue([
        "/templates/template1/index.js",
      ]);

      const templates = await templateManager.getAvailableTemplates();

      expect(templates).toHaveLength(2);
      expect(templates[0].name).toBe("template1");
      expect(templates[1].name).toBe("template2");
    });

    it("should handle template directory read errors", async () => {
      (PathUtils.findTemplatesDir as any).mockReturnValue("/templates");
      (fs.default.readdirSync as any).mockImplementation(() => {
        throw new Error("Permission denied");
      });

      await expect(templateManager.getAvailableTemplates()).rejects.toThrow(
        FileError
      );
    });
  });

  describe("getTemplateInfo", () => {
    it("should validate template name", async () => {
      (Validation.validateTemplateName as any).mockImplementation(() => {
        throw new ValidationError("Invalid template name", "templateName");
      });

      await expect(
        templateManager.getTemplateInfo("invalid-name")
      ).rejects.toThrow(ValidationError);
    });

    it("should return null if template path not found", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue(null);

      const result = await templateManager.getTemplateInfo("nonexistent");

      expect(result).toBeNull();
    });

    it("should return template info without config file", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/test");
      (FileUtils.exists as any).mockReturnValue(false);
      (FileUtils.listDirectory as any).mockReturnValue([
        "/templates/test/index.js",
      ]);

      const result = await templateManager.getTemplateInfo("test");

      expect(result).toEqual({
        name: "test",
        path: "/templates/test",
        description: "test 模板",
        version: "1.0.0",
        author: undefined,
        files: ["/templates/test/index.js"],
      });
    });

    it("should return template info with config file", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/test");
      (FileUtils.exists as any).mockReturnValue(true);
      (FileUtils.readFile as any).mockReturnValue(
        JSON.stringify({
          description: "Test template",
          version: "2.0.0",
          author: "Test Author",
        })
      );
      (FileUtils.listDirectory as any).mockReturnValue([
        "/templates/test/index.js",
      ]);

      const result = await templateManager.getTemplateInfo("test");

      expect(result).toEqual({
        name: "test",
        path: "/templates/test",
        description: "Test template",
        version: "2.0.0",
        author: "Test Author",
        files: ["/templates/test/index.js"],
      });
    });

    it("should handle invalid config file gracefully", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/test");
      (FileUtils.exists as any).mockReturnValue(true);
      (FileUtils.readFile as any).mockReturnValue("invalid json");
      (FileUtils.listDirectory as any).mockReturnValue([]);

      const result = await templateManager.getTemplateInfo("test");

      expect(result?.description).toBe("test 模板");
      expect(result?.version).toBe("1.0.0");
    });

    it("should cache template info", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/test");
      (FileUtils.exists as any).mockReturnValue(false);
      (FileUtils.listDirectory as any).mockReturnValue([]);

      // First call
      await templateManager.getTemplateInfo("test");
      // Second call
      await templateManager.getTemplateInfo("test");

      expect(PathUtils.getTemplatePath).toHaveBeenCalledTimes(1);
    });
  });

  describe("createProject", () => {
    const defaultOptions: TemplateCreateOptions = {
      targetPath: "my-project",
      projectName: "MyProject",
    };

    it("should validate create options", async () => {
      (Validation.validateRequired as any).mockImplementation(() => {
        throw new ValidationError("Required field missing", "field");
      });

      await expect(
        templateManager.createProject(defaultOptions)
      ).rejects.toThrow(ValidationError);
    });

    it("should throw error if template not found", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue(null);

      await expect(
        templateManager.createProject({
          ...defaultOptions,
          templateName: "nonexistent",
        })
      ).rejects.toThrow(FileError);
    });

    it("should throw error if target path already exists", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path === "/resolved/my-project";
      });
      (FileUtils.listDirectory as any).mockReturnValue([]);

      await expect(
        templateManager.createProject(defaultOptions)
      ).rejects.toThrow(FileError);
    });

    it("should create project successfully", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path !== "/resolved/my-project"; // Target doesn't exist
      });
      (FileUtils.listDirectory as any).mockReturnValue([
        "/templates/default/package.json",
      ]);

      await templateManager.createProject(defaultOptions);

      expect(FileUtils.ensureDir).toHaveBeenCalledWith("/resolved/my-project");
      expect(FileUtils.copyDirectory).toHaveBeenCalledWith(
        "/templates/default",
        "/resolved/my-project",
        expect.objectContaining({
          exclude: ["template.json", ".git", "node_modules"],
          overwrite: false,
          recursive: true,
        })
      );
    });

    it("should process template variables", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path !== "/resolved/my-project" && path.includes("package.json");
      });
      (FileUtils.listDirectory as any).mockReturnValue([
        "/resolved/my-project/package.json",
      ]);
      (FileUtils.readFile as any).mockReturnValue(
        '{"name": "{{PROJECT_NAME}}"}'
      );

      await templateManager.createProject({
        ...defaultOptions,
        variables: { CUSTOM_VAR: "custom_value" },
      });

      expect(FileUtils.writeFile).toHaveBeenCalledWith(
        "/resolved/my-project/package.json",
        '{"name": "MyProject"}',
        { overwrite: true }
      );
    });
  });

  describe("validateTemplate", () => {
    it("should return false if template not found", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue(null);

      const isValid = await templateManager.validateTemplate("nonexistent");

      expect(isValid).toBe(false);
    });

    it("should return false if required files missing", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/test");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return !path.includes("package.json");
      });
      (FileUtils.listDirectory as any).mockReturnValue([]);

      const isValid = await templateManager.validateTemplate("test");

      expect(isValid).toBe(false);
    });

    it("should return true if template is valid", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/test");
      (FileUtils.exists as any).mockReturnValue(true);
      (FileUtils.listDirectory as any).mockReturnValue([]);

      const isValid = await templateManager.validateTemplate("test");

      expect(isValid).toBe(true);
    });
  });

  describe("clearCache", () => {
    it("should clear template cache", async () => {
      // Add something to cache first
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/test");
      (FileUtils.exists as any).mockReturnValue(false);
      (FileUtils.listDirectory as any).mockReturnValue([]);

      await templateManager.getTemplateInfo("test");
      templateManager.clearCache();

      // Should call getTemplatePath again after cache clear
      await templateManager.getTemplateInfo("test");
      expect(PathUtils.getTemplatePath).toHaveBeenCalledTimes(2);
    });

    it("should clear cache for multiple templates", async () => {
      (PathUtils.getTemplatePath as any).mockImplementation(
        (name: string) => `/templates/${name}`
      );
      (FileUtils.exists as any).mockReturnValue(false);
      (FileUtils.listDirectory as any).mockReturnValue([]);

      // Cache multiple templates
      await templateManager.getTemplateInfo("template1");
      await templateManager.getTemplateInfo("template2");
      await templateManager.getTemplateInfo("template3");

      templateManager.clearCache();

      // All templates should be re-fetched after cache clear
      await templateManager.getTemplateInfo("template1");
      await templateManager.getTemplateInfo("template2");
      await templateManager.getTemplateInfo("template3");

      expect(PathUtils.getTemplatePath).toHaveBeenCalledTimes(6); // 3 initial + 3 after clear
    });
  });

  describe("copyTemplate", () => {
    it("should copy template to target directory", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path !== "/resolved/my-project";
      });
      (FileUtils.listDirectory as any).mockReturnValue([]);

      await templateManager.copyTemplate("default", "my-project");

      expect(FileUtils.ensureDir).toHaveBeenCalledWith("/resolved/my-project");
    });

    it("should use target path basename as project name", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        // Make sure the resolved target path doesn't exist
        return !path.includes("my-custom-project");
      });
      (FileUtils.listDirectory as any).mockReturnValue([]);

      await templateManager.copyTemplate(
        "default",
        "/path/to/my-custom-project"
      );

      expect(FileUtils.ensureDir).toHaveBeenCalled();
    });

    it("should throw error if copy fails", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.ensureDir as any).mockImplementation(() => {
        throw new Error("Directory creation failed");
      });
      (FileUtils.exists as any).mockReturnValue(false);

      await expect(
        templateManager.copyTemplate("default", "my-project")
      ).rejects.toThrow();
    });
  });

  describe("错误处理和边界条件", () => {
    it("应该处理项目名称验证失败", async () => {
      (Validation.validateProjectName as any).mockImplementation(() => {
        throw new ValidationError("项目名称包含非法字符", "projectName");
      });

      await expect(
        templateManager.createProject({
          templateName: "default",
          targetPath: "/tmp/test",
          projectName: "invalid@name",
        })
      ).rejects.toThrow(ValidationError);
    });

    it("应该处理模板名称验证失败", async () => {
      (Validation.validateTemplateName as any).mockImplementation(() => {
        throw new ValidationError("模板名称包含非法字符", "templateName");
      });

      await expect(
        templateManager.createProject({
          targetPath: "/tmp/test",
          projectName: "test",
          templateName: "invalid@template",
        })
      ).rejects.toThrow(ValidationError);
    });

    it("应该处理复制目录失败", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path !== "/resolved/my-project";
      });
      (FileUtils.copyDirectory as any).mockImplementation(() => {
        throw new Error("Copy failed");
      });
      (FileUtils.listDirectory as any).mockReturnValue([]);

      await expect(
        templateManager.createProject({
          templateName: "default",
          targetPath: "my-project",
          projectName: "MyProject",
        })
      ).rejects.toThrow(FileError);
    });

    it("应该处理空项目名称", async () => {
      (Validation.validateRequired as any).mockImplementation(() => {
        throw new ValidationError("项目名称不能为空", "projectName");
      });

      await expect(
        templateManager.createProject({
          templateName: "default",
          targetPath: "/tmp/test",
          projectName: "",
        })
      ).rejects.toThrow(ValidationError);
    });

    it("应该处理空目标路径", async () => {
      (Validation.validateRequired as any).mockImplementation(() => {
        throw new ValidationError("目标路径不能为空", "targetPath");
      });

      await expect(
        templateManager.createProject({
          templateName: "default",
          targetPath: "",
          projectName: "test",
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("变量替换功能", () => {
    it("应该替换 PROJECT_NAME 变量", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path !== "/resolved/my-project" && path.includes("package.json");
      });
      (FileUtils.listDirectory as any).mockReturnValue([
        "/resolved/my-project/package.json",
      ]);
      (FileUtils.readFile as any).mockReturnValue(
        '{"name": "{{PROJECT_NAME}}", "description": "{{PROJECT_NAME}} project"}'
      );

      await templateManager.createProject({
        templateName: "default",
        targetPath: "my-project",
        projectName: "TestProject",
      });

      expect(FileUtils.writeFile).toHaveBeenCalledWith(
        "/resolved/my-project/package.json",
        '{"name": "TestProject", "description": "TestProject project"}',
        { overwrite: true }
      );
    });

    it("应该替换 PROJECT_NAME_LOWER 变量", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path !== "/resolved/my-project" && path.includes("package.json");
      });
      (FileUtils.listDirectory as any).mockReturnValue([
        "/resolved/my-project/package.json",
      ]);
      (FileUtils.readFile as any).mockReturnValue(
        '{"name": "{{PROJECT_NAME_LOWER}}"}'
      );

      await templateManager.createProject({
        templateName: "default",
        targetPath: "my-project",
        projectName: "MyProject",
      });

      expect(FileUtils.writeFile).toHaveBeenCalledWith(
        "/resolved/my-project/package.json",
        '{"name": "myproject"}',
        { overwrite: true }
      );
    });

    it("应该替换 PROJECT_NAME_UPPER 变量", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path !== "/resolved/my-project" && path.includes("package.json");
      });
      (FileUtils.listDirectory as any).mockReturnValue([
        "/resolved/my-project/package.json",
      ]);
      (FileUtils.readFile as any).mockReturnValue(
        "APP_NAME={{PROJECT_NAME_UPPER}}"
      );

      await templateManager.createProject({
        templateName: "default",
        targetPath: "my-project",
        projectName: "MyProject",
      });

      expect(FileUtils.writeFile).toHaveBeenCalledWith(
        "/resolved/my-project/package.json",
        "APP_NAME=MYPROJECT",
        { overwrite: true }
      );
    });

    it("应该替换自定义变量", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path !== "/resolved/my-project" && path.includes("README.md");
      });
      (FileUtils.listDirectory as any).mockReturnValue([
        "/resolved/my-project/README.md",
      ]);
      (FileUtils.readFile as any).mockReturnValue(
        "Author: {{AUTHOR}}\nVersion: {{VERSION}}"
      );

      await templateManager.createProject({
        templateName: "default",
        targetPath: "my-project",
        projectName: "MyProject",
        variables: {
          AUTHOR: "Test Author",
          VERSION: "2.0.0",
        },
      });

      expect(FileUtils.writeFile).toHaveBeenCalledWith(
        "/resolved/my-project/README.md",
        "Author: Test Author\nVersion: 2.0.0",
        { overwrite: true }
      );
    });

    it("应该处理多个变量在同一行", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path !== "/resolved/my-project" && path.includes("README.md");
      });
      (FileUtils.listDirectory as any).mockReturnValue([
        "/resolved/my-project/README.md",
      ]);
      (FileUtils.readFile as any).mockReturnValue(
        "{{PROJECT_NAME}} - {{PROJECT_NAME_LOWER}} - {{PROJECT_NAME_UPPER}}"
      );

      await templateManager.createProject({
        templateName: "default",
        targetPath: "my-project",
        projectName: "MyProject",
      });

      expect(FileUtils.writeFile).toHaveBeenCalledWith(
        "/resolved/my-project/README.md",
        "MyProject - myproject - MYPROJECT",
        { overwrite: true }
      );
    });

    it("应该处理变量周围的空格", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path !== "/resolved/my-project" && path.includes("package.json");
      });
      (FileUtils.listDirectory as any).mockReturnValue([
        "/resolved/my-project/package.json",
      ]);
      (FileUtils.readFile as any).mockReturnValue("{{ PROJECT_NAME }}");

      await templateManager.createProject({
        templateName: "default",
        targetPath: "my-project",
        projectName: "Test",
      });

      expect(FileUtils.writeFile).toHaveBeenCalledWith(
        "/resolved/my-project/package.json",
        "Test",
        { overwrite: true }
      );
    });
  });

  describe("模板文件处理", () => {
    it("应该过滤掉 node_modules 目录中的文件", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/test");
      (FileUtils.exists as any).mockReturnValue(false);
      (FileUtils.listDirectory as any).mockReturnValue([
        "/templates/test/package.json",
        "/templates/test/node_modules/package/index.js",
        "/templates/test/src/index.ts",
      ]);

      const result = await templateManager.getTemplateInfo("test");

      // node_modules 文件应该被过滤
      expect(result?.files).toBeDefined();
      expect(
        result?.files.some((f: string) => f.includes("node_modules"))
      ).toBe(false);
    });

    it("应该过滤掉 template.json 文件", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/test");
      (FileUtils.exists as any).mockReturnValue(false);
      (FileUtils.listDirectory as any).mockReturnValue([
        "/templates/test/package.json",
        "/templates/test/template.json",
        "/templates/test/src/index.ts",
      ]);

      const result = await templateManager.getTemplateInfo("test");

      expect(result?.files).toBeDefined();
      expect(
        result?.files.some((f: string) => f.includes("template.json"))
      ).toBe(false);
    });

    it("应该过滤掉隐藏文件", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/test");
      (FileUtils.exists as any).mockReturnValue(false);
      (FileUtils.listDirectory as any).mockReturnValue([
        "/templates/test/package.json",
        "/templates/test/.git/config",
        "/templates/test/.env.example",
        "/templates/test/src/index.ts",
      ]);

      const result = await templateManager.getTemplateInfo("test");

      expect(result?.files).toBeDefined();
      // 所有隐藏文件应该被过滤
      const hasHiddenFiles = result?.files.some(
        (f: string) => f.includes("/.") || f.includes("\\.")
      );
      expect(hasHiddenFiles).toBe(false);
    });
  });

  describe("getAvailableTemplates 边界条件", () => {
    it("应该处理空模板目录", async () => {
      (PathUtils.findTemplatesDir as any).mockReturnValue("/templates");
      (fs.default.readdirSync as any).mockReturnValue([]);
      (FileUtils.exists as any).mockReturnValue(false);

      const templates = await templateManager.getAvailableTemplates();

      expect(templates).toEqual([]);
    });

    it("应该跳过非目录项", async () => {
      (PathUtils.findTemplatesDir as any).mockReturnValue("/templates");
      (fs.default.readdirSync as any).mockReturnValue([
        { name: "readme.txt", isDirectory: () => false },
        { name: "config.json", isDirectory: () => false },
      ]);
      (FileUtils.exists as any).mockReturnValue(false);

      const templates = await templateManager.getAvailableTemplates();

      expect(templates).toEqual([]);
    });

    it("应该处理模板信息获取失败", async () => {
      (PathUtils.findTemplatesDir as any).mockReturnValue("/templates");
      (fs.default.readdirSync as any).mockReturnValue([
        { name: "broken", isDirectory: () => true },
        { name: "valid", isDirectory: () => true },
      ]);
      (PathUtils.getTemplatePath as any).mockImplementation((name: string) => {
        if (name === "broken") throw new Error("Broken template");
        return `/templates/${name}`;
      });
      (FileUtils.exists as any).mockReturnValue(false);
      (FileUtils.listDirectory as any).mockReturnValue([]);

      const templates = await templateManager.getAvailableTemplates();

      // 应该只返回有效的模板
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe("valid");
    });
  });

  describe("validateTemplate 边界条件", () => {
    it("应该在模板信息获取失败时返回 false", async () => {
      (Validation.validateTemplateName as any).mockImplementation(() => {
        throw new ValidationError("验证失败", "templateName");
      });

      const isValid = await templateManager.validateTemplate("invalid");

      expect(isValid).toBe(false);
    });

    it("应该处理多个必要文件检查", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/test");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        // 只有 package.json 存在
        return path.includes("package.json");
      });
      (FileUtils.listDirectory as any).mockReturnValue([]);

      const isValid = await templateManager.validateTemplate("test");

      expect(isValid).toBe(true);
    });
  });

  describe("createProject 边界条件", () => {
    it("应该处理创建项目时的通用错误", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockReturnValue(false);
      (FileUtils.ensureDir as any).mockImplementation(() => {
        throw new Error("Unknown error");
      });

      await expect(
        templateManager.createProject({
          templateName: "default",
          targetPath: "my-project",
          projectName: "MyProject",
        })
      ).rejects.toThrow(FileError);
    });

    it("应该使用默认模板名称", async () => {
      (PathUtils.getTemplatePath as any).mockImplementation((name?: string) => {
        return `/templates/${name || "default"}`;
      });
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path !== "/resolved/my-project";
      });
      (FileUtils.listDirectory as any).mockReturnValue([]);

      await templateManager.createProject({
        targetPath: "my-project",
        projectName: "MyProject",
      });

      expect(PathUtils.getTemplatePath).toHaveBeenCalledWith("default");
    });
  });
});
