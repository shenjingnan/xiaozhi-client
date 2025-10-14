import { execa } from "execa";
import { logger } from "../Logger.js";

export class NPMManager {
  private logger = logger.withTag("NPMManager");

  /**
   * 安装指定版本 - 这是核心功能
   */
  async installVersion(version: string): Promise<void> {
    this.logger.info(`执行安装: xiaozhi-client@${version}`);

    // 直接执行 npm install 命令
    const { stdout, stderr } = await execa(
      `npm install -g xiaozhi-client@${version}`
    );

    this.logger.info("安装命令执行完成");
    this.logger.debug("npm stdout:", stdout);

    if (stderr) {
      this.logger.warn("npm stderr:", stderr);
    }

    // 验证安装是否成功（简单验证）
    try {
      const currentVersion = await this.getCurrentVersion();
      this.logger.info(`当前版本: ${currentVersion}`);
    } catch (verifyError) {
      this.logger.error("版本验证失败:", verifyError);
      throw new Error("安装验证失败");
    }
  }

  /**
   * 获取当前版本
   */
  async getCurrentVersion(): Promise<string> {
    const { stdout } = await execa(
      "npm list -g xiaozhi-client --depth=0 --json"
    );
    const info = JSON.parse(stdout);
    return info.dependencies?.["xiaozhi-client"]?.version || "unknown";
  }
}
