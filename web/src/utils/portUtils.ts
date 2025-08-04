/**
 * 端口连通性检测工具函数
 */

/**
 * 检测指定端口是否可用
 * @param port 端口号
 * @param timeout 超时时间（毫秒），默认3秒
 * @returns Promise<boolean> 端口是否可用
 */
export async function checkPortAvailability(
  port: number,
  timeout = 3000
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // 尝试连接到服务端的健康检查端点
    // 先尝试 WebServer 的 /api/status 端点，如果失败再尝试 MCPServer 的 /health 端点
    let response: Response;
    try {
      response = await fetch(`http://localhost:${port}/api/status`, {
        method: "GET",
        signal: controller.signal,
      });
    } catch {
      // 如果 /api/status 失败，尝试 /health 端点
      response = await fetch(`http://localhost:${port}/health`, {
        method: "GET",
        signal: controller.signal,
      });
    }

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    // 连接失败或超时
    return false;
  }
}

/**
 * 轮询检测端口直到可用或超时
 * @param port 端口号
 * @param maxAttempts 最大尝试次数，默认30次
 * @param interval 检测间隔（毫秒），默认2秒
 * @param onProgress 进度回调函数
 * @returns Promise<boolean> 是否在超时前检测到端口可用
 */
export async function pollPortUntilAvailable(
  port: number,
  maxAttempts = 30,
  interval = 2000,
  onProgress?: (attempt: number, maxAttempts: number) => void
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (onProgress) {
      onProgress(attempt, maxAttempts);
    }

    const isAvailable = await checkPortAvailability(port, 1000);
    if (isAvailable) {
      return true;
    }

    // 如果不是最后一次尝试，等待指定间隔
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  return false;
}

/**
 * 构建 WebSocket URL
 * @param port 端口号
 * @param hostname 主机名，默认使用当前页面的 hostname
 * @returns WebSocket URL
 */
export function buildWebSocketUrl(port: number, hostname?: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = hostname || window.location.hostname || "localhost";

  // 如果是标准端口（80 for HTTP, 443 for HTTPS），不显示端口号
  if (
    (protocol === "ws:" && port === 80) ||
    (protocol === "wss:" && port === 443)
  ) {
    return `${protocol}//${host}`;
  }

  return `${protocol}//${host}:${port}`;
}

/**
 * 从 WebSocket URL 中提取端口号
 * @param url WebSocket URL
 * @returns 端口号，如果无法提取则返回 null
 */
export function extractPortFromUrl(url: string): number | null {
  try {
    const urlObj = new URL(url);
    const port = Number.parseInt(urlObj.port);
    return Number.isNaN(port) ? null : port;
  } catch {
    return null;
  }
}
