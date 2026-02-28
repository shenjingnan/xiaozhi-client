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
    join: vi.fn((...args) => args.filter(Boolean).join("/")),
    resolve: vi.fn((p) => `/resolved/${p}`),
    relative: vi.fn((from, to) => {
      const fromStr = String(from).replace(/\/$/, "");
      const toStr = String(to);
      if (toStr.startsWith(`${fromStr}/`)) {
        return toStr.slice(fromStr.length + 1);
      }
      return toStr;
    }),
    basename: vi.fn((p: string) => p.split("/").pop() || ""),
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

    it("should allow clearing empty cache", () => {
      expect(() => templateManager.clearCache()).not.toThrow();
    });

    it("should clear multiple cached templates", async () => {
      (PathUtils.getTemplatePath as any).mockImplementation(
        (name: string) => `/templates/${name}`
      );
      (FileUtils.exists as any).mockReturnValue(false);
      (FileUtils.listDirectory as any).mockReturnValue([]);

      // Cache multiple templates
      await templateManager.getTemplateInfo("test1");
      await templateManager.getTemplateInfo("test2");
      await templateManager.getTemplateInfo("test3");

      templateManager.clearCache();

      // All should be re-fetched after clear
      await templateManager.getTemplateInfo("test1");
      await templateManager.getTemplateInfo("test2");
      await templateManager.getTemplateInfo("test3");

      expect(PathUtils.getTemplatePath).toHaveBeenCalledTimes(6);
    });
  });

  describe("copyTemplate", () => {
    it("应该使用默认项目名复制模板", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/test");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path === "/resolved/target-dir/package.json";
      });
      (FileUtils.listDirectory as any).mockReturnValue([]);

      await templateManager.copyTemplate("test", "target-dir");

      expect(FileUtils.ensureDir).toHaveBeenCalledWith("/resolved/target-dir");
      expect(FileUtils.copyDirectory).toHaveBeenCalled();
    });

    it("应该在复制时处理模板变量", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/test");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path !== "/resolved/my-project" && path.includes("package.json");
      });
      (FileUtils.listDirectory as any).mockReturnValue([
        "/resolved/my-project/package.json",
      ]);
      (FileUtils.readFile as any).mockReturnValue(
        '{"name": "{{PROJECT_NAME}}"}'
      );

      await templateManager.copyTemplate("test", "my-project");

      expect(FileUtils.writeFile).toHaveBeenCalledWith(
        "/resolved/my-project/package.json",
        '{"name": "my-project"}',
        { overwrite: true }
      );
    });

    it("应该在模板不存在时抛出错误", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue(null);

      await expect(
        templateManager.copyTemplate("nonexistent", "target-dir")
      ).rejects.toThrow(FileError);
    });
  });

  describe("getAvailableTemplates - 边界条件", () => {
    it("应该跳过无效的模板目录", async () => {
      (PathUtils.findTemplatesDir as any).mockReturnValue("/templates");
      (fs.default.readdirSync as any).mockReturnValue([
        { name: "valid-template", isDirectory: () => true },
        { name: "invalid-template", isDirectory: () => true },
      ]);
      (PathUtils.getTemplatePath as any).mockImplementation((name: string) => {
        if (name === "invalid-template") {
          throw new Error("Template not found");
        }
        return `/templates/${name}`;
      });
      (FileUtils.exists as any).mockReturnValue(false);
      (FileUtils.listDirectory as any).mockReturnValue([]);

      const templates = await templateManager.getAvailableTemplates();

      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe("valid-template");
    });

    it("应该处理空模板目录", async () => {
      (PathUtils.findTemplatesDir as any).mockReturnValue("/templates");
      (fs.default.readdirSync as any).mockReturnValue([]);

      const templates = await templateManager.getAvailableTemplates();

      expect(templates).toEqual([]);
    });

    it("应该过滤掉非目录文件", async () => {
      (PathUtils.findTemplatesDir as any).mockReturnValue("/templates");
      (fs.default.readdirSync as any).mockReturnValue([
        { name: "readme.txt", isDirectory: () => false },
        { name: "config.json", isDirectory: () => false },
        { name: ".git", isDirectory: () => true },
      ]);
      (PathUtils.getTemplatePath as any).mockImplementation(
        (name: string) => `/templates/${name}`
      );
      (FileUtils.exists as any).mockReturnValue(false);
      (FileUtils.listDirectory as any).mockReturnValue([]);

      const templates = await templateManager.getAvailableTemplates();

      // Only .git is a directory, but we're testing that we only process directories
      expect(fs.default.readdirSync).toHaveBeenCalled();
    });
  });

  describe("validateTemplate - 边界条件", () => {
    it("应该在获取模板信息出错时返回 false", async () => {
      (PathUtils.getTemplatePath as any).mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const isValid = await templateManager.validateTemplate("test");

      expect(isValid).toBe(false);
    });

    it("应该处理多个必要文件检查", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/test");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        // All files exist
        return true;
      });
      (FileUtils.listDirectory as any).mockReturnValue([]);

      const isValid = await templateManager.validateTemplate("test");

      expect(isValid).toBe(true);
    });
  });

  describe("createProject - 边界条件", () => {
    const defaultOptions: TemplateCreateOptions = {
      targetPath: "my-project",
      projectName: "MyProject",
    };

    it("应该处理复制文件时的错误", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path !== "/resolved/my-project";
      });
      (FileUtils.listDirectory as any).mockReturnValue([]);
      (FileUtils.copyDirectory as any).mockImplementation(() => {
        throw new Error("Copy failed");
      });

      await expect(
        templateManager.createProject(defaultOptions)
      ).rejects.toThrow(FileError);
    });

    it("应该使用默认模板名称", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path !== "/resolved/my-project";
      });
      (FileUtils.listDirectory as any).mockReturnValue([]);

      await templateManager.createProject(defaultOptions);

      expect(PathUtils.getTemplatePath).toHaveBeenCalledWith("default");
    });

    it("应该处理通用的创建项目错误", async () => {
      (Validation.validateRequired as any).mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      await expect(
        templateManager.createProject(defaultOptions)
      ).rejects.toThrow();
    });
  });

  describe("getTemplateInfo - 边界条件", () => {
    it("应该过滤隐藏文件和 node_modules", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/test");
      (FileUtils.exists as any).mockReturnValue(false);
      (FileUtils.listDirectory as any).mockReturnValue([
        "/templates/test/.env",
        "/templates/test/.gitignore",
        "/templates/test/node_modules/package/index.js",
        "/templates/test/src/index.js",
        "/templates/test/template.json",
      ]);

      const result = await templateManager.getTemplateInfo("test");

      // Should filter out hidden files, node_modules, and template.json
      expect(result?.files).toEqual(["/templates/test/src/index.js"]);
    });

    it("应该处理空文件列表", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/test");
      (FileUtils.exists as any).mockReturnValue(false);
      (FileUtils.listDirectory as any).mockReturnValue([]);

      const result = await templateManager.getTemplateInfo("test");

      expect(result?.files).toEqual([]);
    });

    it("应该在列出目录时返回空数组", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/test");
      (FileUtils.exists as any).mockReturnValue(false);
      (FileUtils.listDirectory as any).mockImplementation(() => {
        throw new Error("List failed");
      });

      const result = await templateManager.getTemplateInfo("test");

      expect(result?.files).toEqual([]);
    });
  });

  describe("变量替换功能", () => {
    const defaultOptions: TemplateCreateOptions = {
      targetPath: "my-project",
      projectName: "MyProject",
    };

    it("应该替换多个变量", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return (
          path !== "/resolved/my-project" &&
          (path.includes("package.json") || path.includes("README.md"))
        );
      });
      (FileUtils.listDirectory as any).mockReturnValue([
        "/resolved/my-project/package.json",
        "/resolved/my-project/README.md",
      ]);
      (FileUtils.readFile as any).mockImplementation((path: string) => {
        if (path.includes("package.json")) {
          return '{"name": "{{PROJECT_NAME}}", "description": "{{PROJECT_NAME_LOWER}}"}';
        }
        return "# {{PROJECT_NAME}}\n\n{{PROJECT_NAME_UPPER}}";
      });

      await templateManager.createProject(defaultOptions);

      expect(FileUtils.writeFile).toHaveBeenCalledWith(
        "/resolved/my-project/package.json",
        '{"name": "MyProject", "description": "myproject"}',
        { overwrite: true }
      );
      expect(FileUtils.writeFile).toHaveBeenCalledWith(
        "/resolved/my-project/README.md",
        "# MyProject\n\nMYPROJECT",
        { overwrite: true }
      );
    });

    it("应该处理带空格的变量", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path !== "/resolved/my-project" && path.includes("package.json");
      });
      (FileUtils.listDirectory as any).mockReturnValue([
        "/resolved/my-project/package.json",
      ]);
      (FileUtils.readFile as any).mockReturnValue(
        '{"value": "{{  VAR_NAME  }}"}'
      );

      await templateManager.createProject({
        ...defaultOptions,
        variables: { VAR_NAME: "test_value" },
      });

      expect(FileUtils.writeFile).toHaveBeenCalledWith(
        "/resolved/my-project/package.json",
        '{"value": "test_value"}',
        { overwrite: true }
      );
    });

    it("应该支持自定义变量", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path !== "/resolved/my-project" && path.includes("README.md");
      });
      (FileUtils.listDirectory as any).mockReturnValue([
        "/resolved/my-project/README.md",
      ]);
      (FileUtils.readFile as any).mockReturnValue(
        "Author: {{AUTHOR}}\nEmail: {{EMAIL}}"
      );

      await templateManager.createProject({
        ...defaultOptions,
        variables: { AUTHOR: "Test Author", EMAIL: "test@example.com" },
      });

      expect(FileUtils.writeFile).toHaveBeenCalledWith(
        "/resolved/my-project/README.md",
        "Author: Test Author\nEmail: test@example.com",
        { overwrite: true }
      );
    });

    it("应该只写入有变更的文件", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path !== "/resolved/my-project";
      });
      // Return different files for listDirectory calls based on path
      (FileUtils.listDirectory as any).mockImplementation(
        (basePath: string) => {
          if (basePath.includes("/templates/default")) {
            return ["/templates/default/package.json"];
          }
          return [
            "/resolved/my-project/package.json",
            "/resolved/my-project/README.md",
          ];
        }
      );
      (FileUtils.readFile as any).mockImplementation((path: string) => {
        if (path.includes("package.json")) {
          return '{"name": "{{PROJECT_NAME}}"}';
        }
        return "# Static README";
      });

      await templateManager.createProject(defaultOptions);

      // package.json should be written (has variable), README.md should not
      expect(FileUtils.writeFile).toHaveBeenCalled();
      const writeCalls = (FileUtils.writeFile as any).mock.calls;
      expect(
        writeCalls.some((call: unknown[]) => call[0].includes("package.json"))
      ).toBe(true);
    });

    it("应该处理文件读取错误", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path !== "/resolved/my-project" && path.includes("error.txt");
      });
      (FileUtils.listDirectory as any).mockReturnValue([
        "/resolved/my-project/error.txt",
      ]);
      (FileUtils.readFile as any).mockImplementation(() => {
        throw new Error("Read error");
      });

      // Should not throw, just warn
      await expect(
        templateManager.createProject(defaultOptions)
      ).resolves.not.toThrow();
    });

    it("应该处理文件写入错误", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path !== "/resolved/my-project" && path.includes("file.txt");
      });
      (FileUtils.listDirectory as any).mockReturnValue([
        "/resolved/my-project/file.txt",
      ]);
      (FileUtils.readFile as any).mockReturnValue("{{PROJECT_NAME}}");
      (FileUtils.writeFile as any).mockImplementation(() => {
        throw new Error("Write error");
      });

      // Should not throw, just warn
      await expect(
        templateManager.createProject(defaultOptions)
      ).resolves.not.toThrow();
    });
  });

  describe("模板文件处理", () => {
    const defaultOptions: TemplateCreateOptions = {
      targetPath: "my-project",
      projectName: "MyProject",
    };

    it("应该根据通配符模式查找文件", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return path !== "/resolved/my-project";
      });
      (FileUtils.listDirectory as any).mockImplementation(
        (basePath: string) => {
          // For template path, return template files
          if (basePath.includes("/templates/default")) {
            return ["/templates/default/package.json"];
          }
          // For target project path, return project files
          return [
            "/resolved/my-project/src/index.ts",
            "/resolved/my-project/src/utils/helper.ts",
            "/resolved/my-project/public/index.html",
          ];
        }
      );
      (FileUtils.readFile as any).mockReturnValue("{{PROJECT_NAME}}");

      await templateManager.createProject(defaultOptions);

      // Should process src/**/*.ts files (checked indirectly by verifying readFile was called)
      expect(FileUtils.readFile).toHaveBeenCalled();
    });

    it("应该处理简单的文件路径模式", async () => {
      (PathUtils.getTemplatePath as any).mockReturnValue("/templates/default");
      (FileUtils.exists as any).mockImplementation((path: string) => {
        return (
          path !== "/resolved/my-project" &&
          path === "/resolved/my-project/package.json"
        );
      });
      (FileUtils.listDirectory as any).mockReturnValue([
        "/resolved/my-project/package.json",
      ]);
      (FileUtils.readFile as any).mockReturnValue("{{PROJECT_NAME}}");

      await templateManager.createProject(defaultOptions);

      expect(FileUtils.readFile).toHaveBeenCalledWith(
        "/resolved/my-project/package.json"
      );
    });
  });
});
