import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "../Logger.js";

const execAsync = promisify(exec);

export class NPMManager {
  private logger = logger.withTag("NPMManager");

  /**
   * 安装指定版本 - 这是核心功能
   */
  async installVersion(version: string): Promise<void> {
    this.logger.info(`执行安装: xiaozhi-client@${version}`);

    // 执行安装命令
    const npmProcess = spawn("npm", [
      "install",
      "-g",
      `xiaozhi-client@${version}`,
      "--registry=https://registry.npmmirror.com",
    ]);

    // 监听标准输出
    npmProcess.stdout.on("data", (data) => {
      console.log(data.toString());
      // sendEvent('log', {
      //   type: 'stdout',
      //   message: data.toString()
      // });
    });

    // 监听错误输出
    npmProcess.stderr.on("data", (data) => {
      console.log(data.toString());
      // sendEvent('log', {
      //   type: 'stderr',
      //   message: data.toString()
      // });
    });

    // 监听进程结束
    npmProcess.on("close", (code) => {
      if (code === 0) {
        console.log("安装完成！");
        // sendEvent('success', {
        //   message: '安装完成！',
        //   code
        // });
      } else {
        console.log("安装失败");
        // sendEvent('error', {
        //   message: '安装失败',
        //   code
        // });
      }
      // res.end();
    });

    // this.logger.info("安装命令执行完成");
    // this.logger.debug("npm stdout:", stdout);

    // if (stderr) {
    //   this.logger.warn("npm stderr:", stderr);
    // }

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
    const { stdout } = await execAsync(
      "npm list -g xiaozhi-client --depth=0 --json --registry=https://registry.npmmirror.com"
    );
    const info = JSON.parse(stdout);
    return info.dependencies?.["xiaozhi-client"]?.version || "unknown";
  }
}
