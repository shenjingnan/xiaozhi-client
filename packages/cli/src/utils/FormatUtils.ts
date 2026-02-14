/**
 * 格式化工具
 */

/**
 * 格式化工具类
 */
export class FormatUtils {
  /**
   * 格式化运行时间
   */
  static formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}天 ${hours % 24}小时 ${minutes % 60}分钟`;
    }
    if (hours > 0) {
      return `${hours}小时 ${minutes % 60}分钟`;
    }
    if (minutes > 0) {
      return `${minutes}分钟 ${seconds % 60}秒`;
    }
    return `${seconds}秒`;
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes: number): string {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  /**
   * 格式化时间戳
   */
  static formatTimestamp(
    timestamp: number,
    format: "full" | "date" | "time" = "full"
  ): string {
    const date = new Date(timestamp);

    switch (format) {
      case "date":
        return date.toLocaleDateString("zh-CN");
      case "time":
        return date.toLocaleTimeString("zh-CN");
      default:
        return date.toLocaleString("zh-CN");
    }
  }

  /**
   * 格式化进程 ID
   */
  static formatPid(pid: number): string {
    return `PID: ${pid}`;
  }

  /**
   * 格式化端口号
   */
  static formatPort(port: number): string {
    return `端口: ${port}`;
  }

  /**
   * 格式化 URL
   */
  static formatUrl(
    protocol: string,
    host: string,
    port: number,
    path?: string
  ): string {
    const url = `${protocol}://${host}:${port}`;
    return path ? `${url}${path}` : url;
  }

  /**
   * 格式化配置键值对
   */
  static formatConfigPair(key: string, value: any): string {
    if (typeof value === "object") {
      return `${key}: ${JSON.stringify(value, null, 2)}`;
    }
    return `${key}: ${value}`;
  }

  /**
   * 格式化错误消息
   */
  static formatError(error: Error, includeStack = false): string {
    let message = `错误: ${error.message}`;

    if (includeStack && error.stack) {
      message += `\n堆栈信息:\n${error.stack}`;
    }

    return message;
  }

  /**
   * 格式化列表
   */
  static formatList(items: string[], bullet = "•"): string {
    return items.map((item) => `${bullet} ${item}`).join("\n");
  }

  /**
   * 格式化表格数据
   */
  static formatTable(data: Record<string, any>[]): string {
    if (data.length === 0) return "";

    const keys = Object.keys(data[0]);
    const maxWidths = keys.map((key) =>
      Math.max(key.length, ...data.map((row) => String(row[key]).length))
    );

    // 表头
    const header = keys.map((key, i) => key.padEnd(maxWidths[i])).join(" | ");
    const separator = maxWidths.map((width) => "-".repeat(width)).join("-|-");

    // 数据行
    const rows = data.map((row) =>
      keys.map((key, i) => String(row[key]).padEnd(maxWidths[i])).join(" | ")
    );

    return [header, separator, ...rows].join("\n");
  }

  /**
   * 格式化进度条
   */
  static formatProgressBar(current: number, total: number, width = 20): string {
    const percentage = Math.min(current / total, 1);
    const filled = Math.floor(percentage * width);
    const empty = width - filled;

    const bar = "█".repeat(filled) + "░".repeat(empty);
    const percent = Math.floor(percentage * 100);

    return `[${bar}] ${percent}% (${current}/${total})`;
  }

  /**
   * 格式化命令行参数
   */
  static formatCommandArgs(command: string, args: string[]): string {
    const quotedArgs = args.map((arg) =>
      arg.includes(" ") ? `"${arg}"` : arg
    );
    return `${command} ${quotedArgs.join(" ")}`;
  }

  /**
   * 截断长文本
   */
  static truncateText(text: string, maxLength: number, suffix = "..."): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  /**
   * 格式化 JSON
   */
  static formatJson(obj: any, indent = 2): string {
    try {
      return JSON.stringify(obj, null, indent);
    } catch (error) {
      return String(obj);
    }
  }

  /**
   * 格式化布尔值
   */
  static formatBoolean(
    value: boolean,
    trueText = "是",
    falseText = "否"
  ): string {
    return value ? trueText : falseText;
  }

  /**
   * 计算两个字符串的相似度（使用编辑距离算法）
   * 返回值范围 [0, 1]，1 表示完全相同
   */
  static calculateSimilarity(str1: string, str2: string): number {
    // 简单的字符串相似度计算
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    // 使用 Levenshtein 距离算法
    const matrix: number[][] = [];

    // 初始化矩阵
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    // 填充矩阵
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // 替换
            matrix[i][j - 1] + 1, // 插入
            matrix[i - 1][j] + 1 // 删除
          );
        }
      }
    }

    // 计算相似度：1 - (编辑距离 / 最大长度)
    const maxLen = Math.max(len1, len2);
    return 1 - matrix[len2][len1] / maxLen;
  }
}
