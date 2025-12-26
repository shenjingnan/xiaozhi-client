/**
 * 模板管理服务单元测试
 */

import { FileError, ValidationError } from "../../errors/index";
import type { TemplateCreateOptions } from "../TemplateManager";
import { TemplateManagerImpl } from "../TemplateManager";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock 依赖
vi.mock("@cli/utils/PathUtils.js", () => ({
  PathUtils: {
    findTemplatesDir: vi.fn(),
    getTemplatePath: vi.fn(),
  },
}));

vi.mock("@cli/utils/FileUtils.js", () => ({
  FileUtils: {
    exists: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    ensureDir: vi.fn(),
    copyDirectory: vi.fn(),
    listDirectory: vi.fn(),
  },
}));

vi.mock("@cli/utils/Validation.js", () => ({
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
    relative: vi.fn((from, to) => String(to).replace(`${String(from)}/`, "")),
  },
}));

const { PathUtils } = await import("@cli/utils/PathUtils.js");
const { FileUtils } = await import("@cli/utils/FileUtils.js");
const { Validation } = await import("@cli/utils/Validation.js");
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
  });
});
