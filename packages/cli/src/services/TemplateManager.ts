/**
 * 模板管理服务
 */

import fs from "node:fs";
import path from "node:path";
import { FileError, ValidationError } from "../errors/index";
import type {
  TemplateManager as ITemplateManager,
  TemplateCreateOptions,
  TemplateInfo,
} from "../interfaces/Service";
import { FileUtils } from "../utils/FileUtils";
import { PathUtils } from "../utils/PathUtils";
import { Validation } from "../utils/Validation";

// 重新导出类型以保持向后兼容
export type { TemplateInfo, TemplateCreateOptions };

/**
 * 模板管理器实现
 */
export class TemplateManagerImpl implements ITemplateManager {
  private templateCache = new Map<string, TemplateInfo>();

  /**
   * 获取可用模板列表
   */
  async getAvailableTemplates(): Promise<TemplateInfo[]> {
    try {
      const templatesDir = PathUtils.findTemplatesDir();

      if (!templatesDir) {
        return [];
      }

      const templates: TemplateInfo[] = [];
      const templateDirs = fs
        .readdirSync(templatesDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      for (const templateName of templateDirs) {
        try {
          const templateInfo = await this.getTemplateInfo(templateName);
          if (templateInfo) {
            templates.push(templateInfo);
          }
        } catch (_error) {
          // 跳过无效的模板目录
          console.warn(`跳过无效模板: ${templateName}`);
        }
      }

      return templates;
    } catch (_error) {
      throw new FileError(
        "无法读取模板目录",
        PathUtils.findTemplatesDir() || ""
      );
    }
  }

  /**
   * 获取模板信息
   */
  async getTemplateInfo(templateName: string): Promise<TemplateInfo | null> {
    try {
      // 验证模板名称
      Validation.validateTemplateName(templateName);

      // 检查缓存
      if (this.templateCache.has(templateName)) {
        return this.templateCache.get(templateName)!;
      }

      const templatePath = PathUtils.getTemplatePath(templateName);
      if (!templatePath) {
        return null;
      }

      // 读取模板配置文件
      const configPath = path.join(templatePath, "template.json");
      let config: any = {};

      if (FileUtils.exists(configPath)) {
        try {
          const configContent = FileUtils.readFile(configPath);
          config = JSON.parse(configContent);
        } catch (_error) {
          console.warn(`模板配置文件解析失败: ${templateName}`);
        }
      }

      // 获取模板文件列表
      const files = this.getTemplateFiles(templatePath);

      const templateInfo: TemplateInfo = {
        name: templateName,
        path: templatePath,
        description: config.description || `${templateName} 模板`,
        version: config.version || "1.0.0",
        author: config.author,
        files,
      };

      // 缓存模板信息
      this.templateCache.set(templateName, templateInfo);

      return templateInfo;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new FileError(`无法获取模板信息: ${templateName}`, "");
    }
  }

  /**
   * 复制模板到目标目录
   */
  async copyTemplate(templateName: string, targetPath: string): Promise<void> {
    await this.createProject({
      templateName,
      targetPath,
      projectName: path.basename(targetPath),
    });
  }

  /**
   * 创建项目
   */
  async createProject(options: TemplateCreateOptions): Promise<void> {
    try {
      // 验证输入参数
      this.validateCreateOptions(options);

      // 获取模板信息
      const templateName = options.templateName || "default";
      const templateInfo = await this.getTemplateInfo(templateName);

      if (!templateInfo) {
        throw new FileError(`模板不存在: ${templateName}`, "");
      }

      // 检查目标路径
      const targetPath = path.resolve(options.targetPath);
      if (FileUtils.exists(targetPath)) {
        throw FileError.alreadyExists(targetPath);
      }

      // 创建项目目录
      FileUtils.ensureDir(targetPath);

      // 复制模板文件
      await this.copyTemplateFiles(templateInfo, targetPath, options);

      // 处理模板变量替换
      await this.processTemplateVariables(targetPath, options);

      console.log(`✅ 项目创建成功: ${targetPath}`);
    } catch (error) {
      if (error instanceof FileError || error instanceof ValidationError) {
        throw error;
      }
      throw new FileError(
        `创建项目失败: ${error instanceof Error ? error.message : String(error)}`,
        options.targetPath
      );
    }
  }

  /**
   * 验证模板
   */
  async validateTemplate(templateName: string): Promise<boolean> {
    try {
      const templateInfo = await this.getTemplateInfo(templateName);

      if (!templateInfo) {
        return false;
      }

      // 检查必要文件是否存在
      const requiredFiles = ["package.json"]; // 可以根据需要调整

      for (const requiredFile of requiredFiles) {
        const filePath = path.join(templateInfo.path, requiredFile);
        if (!FileUtils.exists(filePath)) {
          console.warn(`模板缺少必要文件: ${requiredFile}`);
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * 清除模板缓存
   */
  clearCache(): void {
    this.templateCache.clear();
  }

  /**
   * 获取模板文件列表
   */
  private getTemplateFiles(templatePath: string): string[] {
    try {
      const files = FileUtils.listDirectory(templatePath, {
        recursive: true,
        includeHidden: false,
      });

      // 过滤掉模板配置文件和其他不需要的文件
      return files.filter((file) => {
        const relativePath = path.relative(templatePath, file);
        return (
          !relativePath.startsWith(".") &&
          relativePath !== "template.json" &&
          !relativePath.includes("node_modules")
        );
      });
    } catch {
      return [];
    }
  }

  /**
   * 验证创建选项
   */
  private validateCreateOptions(options: TemplateCreateOptions): void {
    Validation.validateRequired(options.targetPath, "targetPath");
    Validation.validateRequired(options.projectName, "projectName");
    Validation.validateProjectName(options.projectName);

    if (options.templateName) {
      Validation.validateTemplateName(options.templateName);
    }
  }

  /**
   * 复制模板文件
   */
  private async copyTemplateFiles(
    templateInfo: TemplateInfo,
    targetPath: string,
    _options: TemplateCreateOptions
  ): Promise<void> {
    try {
      // 复制所有模板文件
      FileUtils.copyDirectory(templateInfo.path, targetPath, {
        exclude: ["template.json", ".git", "node_modules"],
        overwrite: false,
        recursive: true,
      });
    } catch (error) {
      throw new FileError(
        `复制模板文件失败: ${error instanceof Error ? error.message : String(error)}`,
        templateInfo.path
      );
    }
  }

  /**
   * 处理模板变量替换
   */
  private async processTemplateVariables(
    targetPath: string,
    options: TemplateCreateOptions
  ): Promise<void> {
    try {
      // 默认变量
      const variables = {
        PROJECT_NAME: options.projectName,
        PROJECT_NAME_LOWER: options.projectName.toLowerCase(),
        PROJECT_NAME_UPPER: options.projectName.toUpperCase(),
        ...options.variables,
      };

      // 获取需要处理的文件
      const filesToProcess = [
        "package.json",
        "README.md",
        "src/**/*.ts",
        "src/**/*.js",
        "src/**/*.json",
      ];

      for (const pattern of filesToProcess) {
        const files = this.findFilesByPattern(targetPath, pattern);

        for (const filePath of files) {
          await this.replaceVariablesInFile(filePath, variables);
        }
      }
    } catch (error) {
      console.warn(
        `处理模板变量失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 根据模式查找文件
   */
  private findFilesByPattern(basePath: string, pattern: string): string[] {
    try {
      if (!pattern.includes("*")) {
        // 简单文件路径
        const filePath = path.join(basePath, pattern);
        return FileUtils.exists(filePath) ? [filePath] : [];
      }

      // 简单的通配符支持
      const files = FileUtils.listDirectory(basePath, { recursive: true });
      const regex = new RegExp(
        pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")
      );

      return files.filter((file) => {
        // 将路径分隔符统一为 /，确保在 Windows 上也能正确匹配
        const relativePath = path
          .relative(basePath, file)
          .split(path.sep)
          .join("/");
        return regex.test(relativePath);
      });
    } catch {
      return [];
    }
  }

  /**
   * 替换文件中的变量
   */
  private async replaceVariablesInFile(
    filePath: string,
    variables: Record<string, string>
  ): Promise<void> {
    try {
      let content = FileUtils.readFile(filePath);
      let hasChanges = false;

      // 替换变量 {{VARIABLE_NAME}}
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
        if (regex.test(content)) {
          content = content.replace(regex, value);
          hasChanges = true;
        }
      }

      // 如果有变更，写回文件
      if (hasChanges) {
        FileUtils.writeFile(filePath, content, { overwrite: true });
      }
    } catch (error) {
      console.warn(
        `替换文件变量失败 ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
