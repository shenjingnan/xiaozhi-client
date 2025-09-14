/**
 * 任务状态管理器
 * 负责管理 CustomMCP 工具任务的状态转换和跟踪
 * 实现任务ID生成、验证和状态管理功能
 */

import type { Logger } from "../Logger.js";
import type {
  TaskStatus,
  TaskInfo,
  CacheStateTransition,
} from "../types/mcp.js";

/**
 * 扩展的缓存状态转换接口，包含任务ID
 */
interface ExtendedCacheStateTransition extends CacheStateTransition {
  taskId: string;
}

/**
 * 任务状态管理器
 */
export class TaskStateManager {
  private logger: Logger;
  private activeTasks: Map<string, TaskInfo>;
  private taskHistory: ExtendedCacheStateTransition[];

  constructor(logger: Logger) {
    this.logger = logger;
    this.activeTasks = new Map();
    this.taskHistory = [];
  }

  /**
   * 生成任务ID
   */
  public generateTaskId(toolName: string, arguments_: any): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    const taskId = `${toolName}_${timestamp}_${random}`;

    this.logger.debug(`[TaskState] 生成任务ID: ${taskId}`);
    return taskId;
  }

  /**
   * 验证任务ID格式
   */
  public validateTaskId(taskId: string): boolean {
    // 格式: toolName_timestamp_randomString
    const pattern = /^[a-zA-Z0-9_-]+_\d+_[a-zA-Z0-9]+$/;
    const isValid = pattern.test(taskId);

    if (!isValid) {
      this.logger.warn(`[TaskState] 无效的任务ID格式: ${taskId}`);
    }

    return isValid;
  }

  /**
   * 从任务ID中提取工具名称
   */
  public extractToolName(taskId: string): string | null {
    if (!this.validateTaskId(taskId)) {
      return null;
    }

    const parts = taskId.split("_");
    if (parts.length < 3) {
      return null;
    }

    // 重新组合工具名称（处理工具名称中可能包含下划线的情况）
    const timestampIndex = parts.findIndex((part) => /^\d+$/.test(part));
    if (timestampIndex <= 0) {
      return null;
    }

    const toolName = parts.slice(0, timestampIndex).join("_");
    return toolName;
  }

  /**
   * 创建新任务
   */
  public createTask(
    taskId: string,
    toolName: string,
    arguments_: any,
    initialStatus: TaskStatus = "pending"
  ): TaskInfo {
    if (this.activeTasks.has(taskId)) {
      throw new Error(`任务已存在: ${taskId}`);
    }

    const task: TaskInfo = {
      taskId,
      toolName,
      arguments: arguments_,
      status: initialStatus,
      startTime: new Date().toISOString(),
    };

    this.activeTasks.set(taskId, task);
    this.recordStateTransition(taskId, "none", initialStatus, "创建新任务");

    this.logger.info(
      `[TaskState] 创建任务: ${taskId}, 工具: ${toolName}, 状态: ${initialStatus}`
    );
    return task;
  }

  /**
   * 更新任务状态
   */
  public updateTaskStatus(
    taskId: string,
    newStatus: TaskStatus,
    result?: any,
    error?: string
  ): boolean {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      this.logger.warn(`[TaskState] 任务不存在: ${taskId}`);
      return false;
    }

    const oldStatus = task.status;
    task.status = newStatus;

    if (newStatus === "completed" || newStatus === "failed") {
      task.endTime = new Date().toISOString();
    }

    if (result) {
      task.result = result;
    }

    if (error) {
      task.error = error;
    }

    this.recordStateTransition(
      taskId,
      oldStatus,
      newStatus,
      this.getStatusChangeReason(oldStatus, newStatus, error)
    );

    this.logger.info(
      `[TaskState] 更新任务状态: ${taskId} ${oldStatus} -> ${newStatus}`
    );

    return true;
  }

  /**
   * 标记任务为处理中
   */
  public markTaskAsPending(
    taskId: string,
    toolName: string,
    arguments_: any
  ): TaskInfo {
    let task = this.activeTasks.get(taskId);

    if (!task) {
      task = this.createTask(taskId, toolName, arguments_, "pending");
    } else {
      this.updateTaskStatus(taskId, "pending");
    }

    return task;
  }

  /**
   * 标记任务为已完成
   */
  public markTaskAsCompleted(taskId: string, result: any): boolean {
    return this.updateTaskStatus(taskId, "completed", result);
  }

  /**
   * 标记任务为失败
   */
  public markTaskAsFailed(taskId: string, error: string): boolean {
    return this.updateTaskStatus(taskId, "failed", undefined, error);
  }

  /**
   * 标记任务为已消费
   */
  public markTaskAsConsumed(taskId: string): boolean {
    return this.updateTaskStatus(taskId, "consumed");
  }

  /**
   * 获取任务信息
   */
  public getTask(taskId: string): TaskInfo | null {
    return this.activeTasks.get(taskId) || null;
  }

  /**
   * 检查任务是否存在
   */
  public hasTask(taskId: string): boolean {
    return this.activeTasks.has(taskId);
  }

  /**
   * 获取任务状态
   */
  public getTaskStatus(taskId: string): TaskStatus | null {
    const task = this.activeTasks.get(taskId);
    return task ? task.status : null;
  }

  /**
   * 获取指定状态的所有任务
   */
  public getTasksByStatus(status: TaskStatus): TaskInfo[] {
    return Array.from(this.activeTasks.values()).filter(
      (task) => task.status === status
    );
  }

  /**
   * 获取指定工具的所有任务
   */
  public getTasksByTool(toolName: string): TaskInfo[] {
    return Array.from(this.activeTasks.values()).filter(
      (task) => task.toolName === toolName
    );
  }

  /**
   * 获取任务执行时间
   */
  public getTaskExecutionTime(taskId: string): number | null {
    const task = this.activeTasks.get(taskId);
    if (!task || !task.endTime) {
      return null;
    }

    const startTime = new Date(task.startTime).getTime();
    const endTime = new Date(task.endTime).getTime();
    return endTime - startTime;
  }

  /**
   * 检查任务是否超时
   */
  public isTaskTimeout(taskId: string, timeoutMs = 8000): boolean {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      return false;
    }

    const startTime = new Date(task.startTime).getTime();
    const now = Date.now();
    return now - startTime > timeoutMs;
  }

  /**
   * 获取超时的任务列表
   */
  public getTimeoutTasks(timeoutMs = 8000): TaskInfo[] {
    const now = Date.now();
    return Array.from(this.activeTasks.values()).filter((task) => {
      const startTime = new Date(task.startTime).getTime();
      return now - startTime > timeoutMs && task.status === "pending";
    });
  }

  /**
   * 移除任务
   */
  public removeTask(taskId: string): boolean {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      return false;
    }

    this.recordStateTransition(taskId, task.status, "deleted", "任务被移除");

    this.activeTasks.delete(taskId);
    this.logger.info(`[TaskState] 移除任务: ${taskId}`);
    return true;
  }

  /**
   * 清理已完成的任务
   */
  public cleanupCompletedTasks(olderThanMs = 300000): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [taskId, task] of this.activeTasks.entries()) {
      if (task.status === "completed" || task.status === "failed") {
        const endTime = task.endTime ? new Date(task.endTime).getTime() : now;
        if (now - endTime > olderThanMs) {
          this.removeTask(taskId);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      this.logger.info(`[TaskState] 清理已完成任务: ${cleanedCount}个`);
    }

    return cleanedCount;
  }

  /**
   * 获取任务统计信息
   */
  public getTaskStatistics(): {
    total: number;
    pending: number;
    completed: number;
    failed: number;
    consumed: number;
    averageExecutionTime: number;
  } {
    const tasks = Array.from(this.activeTasks.values());
    const total = tasks.length;
    const pending = tasks.filter((t) => t.status === "pending").length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const failed = tasks.filter((t) => t.status === "failed").length;
    const consumed = tasks.filter((t) => t.status === "consumed").length;

    // 计算平均执行时间
    const completedTasks = tasks.filter(
      (t) => t.status === "completed" && t.endTime
    );
    const averageExecutionTime =
      completedTasks.length > 0
        ? completedTasks.reduce((sum, task) => {
            const time = this.getTaskExecutionTime(task.taskId) || 0;
            return sum + time;
          }, 0) / completedTasks.length
        : 0;

    return {
      total,
      pending,
      completed,
      failed,
      consumed,
      averageExecutionTime,
    };
  }

  /**
   * 获取任务历史记录
   */
  public getTaskHistory(taskId?: string): ExtendedCacheStateTransition[] {
    if (taskId) {
      return this.taskHistory.filter(
        (transition) => transition.taskId === taskId
      );
    }
    return [...this.taskHistory];
  }

  /**
   * 记录状态转换
   */
  private recordStateTransition(
    taskId: string,
    fromStatus: string,
    toStatus: TaskStatus,
    reason: string
  ): void {
    const transition: ExtendedCacheStateTransition = {
      from: fromStatus as TaskStatus,
      to: toStatus,
      reason,
      timestamp: new Date().toISOString(),
      taskId,
    };

    this.taskHistory.push(transition);

    // 限制历史记录数量，避免内存泄漏
    if (this.taskHistory.length > 1000) {
      this.taskHistory = this.taskHistory.slice(-500);
    }
  }

  /**
   * 获取状态变更原因
   */
  private getStatusChangeReason(
    fromStatus: string,
    toStatus: TaskStatus,
    error?: string
  ): string {
    if (error) {
      return `执行失败: ${error}`;
    }

    const reasons: Record<string, string> = {
      "none->pending": "任务开始执行",
      "pending->completed": "任务执行成功",
      "pending->failed": "任务执行失败",
      "completed->consumed": "结果被消费",
      "failed->consumed": "失败结果被处理",
      "consumed->deleted": "任务被清理",
    };

    const key = `${fromStatus}->${toStatus}`;
    return reasons[key] || "状态更新";
  }

  /**
   * 验证任务数据完整性
   */
  public validateTaskIntegrity(): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    for (const [taskId, task] of this.activeTasks.entries()) {
      // 验证必需字段
      if (!task.taskId || !task.toolName || !task.status || !task.startTime) {
        issues.push(`任务缺少必需字段: ${taskId}`);
      }

      // 验证时间戳格式
      if (isNaN(new Date(task.startTime).getTime())) {
        issues.push(`无效的开始时间: ${taskId}`);
      }

      if (task.endTime && isNaN(new Date(task.endTime).getTime())) {
        issues.push(`无效的结束时间: ${taskId}`);
      }

      // 验证状态一致性
      if (task.status === "completed" && !task.endTime) {
        issues.push(`已完成任务缺少结束时间: ${taskId}`);
      }

      if (task.status === "failed" && !task.error) {
        issues.push(`失败任务缺少错误信息: ${taskId}`);
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * 重启长时间运行的任务
   */
  public restartStalledTasks(timeoutMs = 30000): number {
    const stalledTasks = this.getTimeoutTasks(timeoutMs);
    let restartedCount = 0;

    for (const task of stalledTasks) {
      this.logger.warn(`[TaskState] 检测到停滞任务: ${task.taskId}`);

      // 标记为失败并重新创建
      this.markTaskAsFailed(task.taskId, "任务执行超时");

      // 创建新的任务实例
      const newTaskId = this.generateTaskId(task.toolName, task.arguments);
      this.createTask(newTaskId, task.toolName, task.arguments, "pending");

      restartedCount++;
    }

    if (restartedCount > 0) {
      this.logger.info(`[TaskState] 重启停滞任务: ${restartedCount}个`);
    }

    return restartedCount;
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.activeTasks.clear();
    this.taskHistory = [];
    this.logger.info("[TaskState] 清理任务状态管理器资源");
  }
}
