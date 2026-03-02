/**
 * 项目管理命令处理器
 */

import path from "node:path";
import consola from "consola";
import ora from "ora";
import type { CommandOption } from "../interfaces/Command";
import { BaseCommandHandler } from "../interfaces/Command";
import type {
  CommandArguments,
  CommandOptions,
} from "../interfaces/CommandTypes";
import type { IDIContainer } from "../interfaces/Config";

/**
 * 项目管理命令处理器
 */
export class ProjectCommandHandler extends BaseCommandHandler {
  override name = "create";
  override description = "创建项目";

  override options: CommandOption[] = [
    {
      flags: "-t, --template <templateName>",
      description: "使用指定模板创建项目",
    },
  ];

  constructor(container: IDIContainer) {
    super(container);
  }

  /**
   * 执行创建项目命令
   */
  override async execute(
    args: CommandArguments,
    options: CommandOptions
  ): Promise<void> {
    this.validateArgs(args, 1);
    const projectName = args[0];

    await this.handleCreate(projectName, options);
  }

  /**
   * 处理创建项目命令
   */
  protected async handleCreate(
    projectName: string,
    options: CommandOptions
  ): Promise<void> {
    const spinner = ora("初始化项目...").start();

    try {
      const templateManager = this.getService<any>("templateManager");
      const fileUtils = this.getService<any>("fileUtils");

      // 确定目标目录
      const targetPath = path.join(process.cwd(), projectName);

      // 检查目标目录是否已存在
      if (await fileUtils.exists(targetPath)) {
        spinner.fail(`目录 "${projectName}" 已存在`);
        consola.log("💡 提示: 请选择不同的项目名称或删除现有目录");
        return;
      }

      if (options.template) {
        // 使用模板创建项目
        await this.createFromTemplate(
          projectName,
          options.template,
          targetPath,
          spinner,
          templateManager
        );
      } else {
        // 创建基本项目（只有配置文件）
        await this.createBasicProject(
          projectName,
          targetPath,
          spinner,
          templateManager
        );
      }
    } catch (error) {
      spinner.fail(
        `创建项目失败: ${error instanceof Error ? error.message : String(error)}`
      );
      this.handleError(error as Error);
    }
  }

  /**
   * 从模板创建项目
   */
  private async createFromTemplate(
    projectName: string,
    templateName: string,
    targetPath: string,
    spinner: any,
    templateManager: any
  ): Promise<void> {
    spinner.text = "检查模板...";

    // 获取可用模板列表
    const availableTemplates = await templateManager.getAvailableTemplates();

    if (availableTemplates.length === 0) {
      spinner.fail("找不到可用模板");
      consola.log("💡 提示: 请确保 xiaozhi-client 正确安装");
      return;
    }

    // 使用局部变量避免重新赋值函数参数
    let actualTemplateName = templateName;

    // 验证模板是否存在
    const isValidTemplate =
      await templateManager.validateTemplate(actualTemplateName);
    if (!isValidTemplate) {
      spinner.fail(`模板 "${actualTemplateName}" 不存在`);

      // 尝试找到相似的模板
      const similarTemplate = this.findSimilarTemplate(
        actualTemplateName,
        availableTemplates
      );

      if (similarTemplate) {
        consola.log(`💡 你是想使用模板 "${similarTemplate}" 吗？`);
        const confirmed = await this.askUserConfirmation(
          "确认使用此模板？(y/n): "
        );

        if (confirmed) {
          actualTemplateName = similarTemplate;
        } else {
          this.showAvailableTemplates(availableTemplates);
          return;
        }
      } else {
        this.showAvailableTemplates(availableTemplates);
        return;
      }
    }

    spinner.text = `从模板 "${actualTemplateName}" 创建项目 "${projectName}"...`;

    // 使用模板管理器创建项目
    await templateManager.createProject({
      templateName: actualTemplateName,
      targetPath,
      projectName,
    });

    spinner.succeed(`项目 "${projectName}" 创建成功`);

    consola.log("✅ 项目创建完成!");
    consola.log("📝 接下来的步骤:");
    consola.log(`   cd ${projectName}`);
    consola.log("   pnpm install  # 安装依赖");
    consola.log("   # 编辑 xiaozhi.config.json 设置你的 MCP 端点");
    consola.log("   xiaozhi start  # 启动服务");
  }

  /**
   * 创建基本项目
   */
  private async createBasicProject(
    projectName: string,
    targetPath: string,
    spinner: any,
    templateManager: any
  ): Promise<void> {
    spinner.text = `创建基本项目 "${projectName}"...`;

    // 使用模板管理器创建基本项目
    await templateManager.createProject({
      templateName: null, // 表示创建基本项目
      targetPath,
      projectName,
    });

    spinner.succeed(`项目 "${projectName}" 创建成功`);

    consola.log("✅ 基本项目创建完成!");
    consola.log("📝 接下来的步骤:");
    consola.log(`   cd ${projectName}`);
    consola.log("   # 编辑 xiaozhi.config.json 设置你的 MCP 端点和服务");
    consola.log("   xiaozhi start  # 启动服务");
    consola.log("💡 提示: 使用 --template 选项可以从模板创建项目");
  }

  /**
   * 显示可用模板
   */
  private showAvailableTemplates(templates: string[]): void {
    consola.log("可用的模板:");
    for (const template of templates) {
      consola.log(`  - ${template}`);
    }
  }

  /**
   * 查找相似模板
   */
  private findSimilarTemplate(
    input: string,
    templates: string[]
  ): string | null {
    const formatUtils = this.getService<any>("formatUtils");

    let bestMatch = null;
    let bestSimilarity = 0;

    for (const template of templates) {
      const similarity = formatUtils.calculateSimilarity(
        input.toLowerCase(),
        template.toLowerCase()
      );
      if (similarity > bestSimilarity && similarity > 0.6) {
        bestSimilarity = similarity;
        bestMatch = template;
      }
    }

    return bestMatch;
  }

  /**
   * 询问用户确认
   */
  private async askUserConfirmation(prompt: string): Promise<boolean> {
    const readline = await import("node:readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(
          answer.toLowerCase().trim() === "y" ||
            answer.toLowerCase().trim() === "yes"
        );
      });
    });
  }
}
