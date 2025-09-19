/**
 * TaskStateManager 单元测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "../../Logger.js";
import type { TaskStatus } from "../../types/mcp.js";
import { TaskStateManager } from "../TaskStateManager.js";

// Mock logger
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("TaskStateManager", () => {
  let manager: TaskStateManager;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      success: vi.fn(),
      initLogFile: vi.fn(),
      enableFileLogging: vi.fn(),
      close: vi.fn(),
      setLogFileOptions: vi.fn(),
      cleanupOldLogs: vi.fn(),
      withTag: vi.fn().mockReturnThis(),
    } as unknown as Logger;
    manager = new TaskStateManager(mockLogger);
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    manager.cleanup();
    vi.useRealTimers();
  });

  describe("构造函数和初始化", () => {
    it("应该正确初始化 TaskStateManager", () => {
      expect(manager).toBeInstanceOf(TaskStateManager);
    });
  });

  describe("任务ID生成", () => {
    it("应该生成有效的任务ID", () => {
      const toolName = "testTool";
      const args = { a: 1, b: 2 };
      const taskId = manager.generateTaskId(toolName, args);

      expect(taskId).toMatch(/testTool_\d+_[a-zA-Z0-9]+/);
      expect(taskId.startsWith("testTool_")).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`[TaskState] 生成任务ID: ${taskId}`)
      );
    });

    it("应该为相同的工具和参数生成不同的任务ID", () => {
      const toolName = "testTool";
      const args = { a: 1 };
      const taskId1 = manager.generateTaskId(toolName, args);
      const taskId2 = manager.generateTaskId(toolName, args);

      expect(taskId1).not.toBe(taskId2);
    });

    it("应该处理包含特殊字符的工具名称", () => {
      const toolName = "test-tool_with.special:chars";
      const args = { data: "test" };
      const taskId = manager.generateTaskId(toolName, args);

      expect(taskId).toMatch(/test-tool_with\.special:chars_\d+_[a-zA-Z0-9]+/);
    });
  });

  describe("任务ID验证", () => {
    it("应该验证有效的任务ID格式", () => {
      const validTaskIds = [
        "tool_1234567890_abc123",
        "my-tool_1234567890_xyz789",
        "complex_tool_name_1234567890_randomString",
        "test_1234567890_abc123def456",
      ];

      for (const taskId of validTaskIds) {
        expect(manager.validateTaskId(taskId)).toBe(true);
      }
    });

    it("应该拒绝无效的任务ID格式", () => {
      const invalidTaskIds = [
        "", // 空字符串
        "tool_", // 缺少时间戳
        "tool_timestamp", // 缺少随机字符串
        "tool_timestamp_", // 随机字符串为空
        "_1234567890_abc123", // 缺少工具名称
        "tool_abc_123", // 时间戳不是数字
        "tool 1234567890 abc123", // 包含空格
        "tool-1234567890-abc123", // 使用了错误的分隔符
      ];

      for (const taskId of invalidTaskIds) {
        expect(manager.validateTaskId(taskId)).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(`[TaskState] 无效的任务ID格式: ${taskId}`)
        );
      }
    });
  });

  describe("工具名称提取", () => {
    it("应该从简单任务ID中提取工具名称", () => {
      const taskId = "simpleTool_1234567890_abc123";
      const toolName = manager.extractToolName(taskId);

      expect(toolName).toBe("simpleTool");
    });

    it("应该从包含下划线的工具名称中正确提取", () => {
      const taskId = "complex_tool_name_1234567890_abc123";
      const toolName = manager.extractToolName(taskId);

      expect(toolName).toBe("complex_tool_name");
    });

    it("应该为无效的任务ID返回null", () => {
      const invalidTaskIds = [
        "invalid_id",
        "tool_abc_123",
        "",
        "tool_timestamp_",
      ];

      for (const taskId of invalidTaskIds) {
        expect(manager.extractToolName(taskId)).toBeNull();
      }
    });

    it("应该处理缺少随机字符串的任务ID", () => {
      const taskId = "tool_1234567890";
      expect(manager.extractToolName(taskId)).toBeNull();
    });
  });

  describe("任务创建", () => {
    it("应该创建新任务", () => {
      const taskId = "test_1234567890_abc123";
      const toolName = "testTool";
      const args = { input: "data" };

      const task = manager.createTask(taskId, toolName, args);

      expect(task.taskId).toBe(taskId);
      expect(task.toolName).toBe(toolName);
      expect(task.arguments).toBe(args);
      expect(task.status).toBe("pending");
      expect(task.startTime).toBeDefined();
      expect(task.endTime).toBeUndefined();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`[TaskState] 创建任务: ${taskId}`)
      );
    });

    it("应该使用指定的初始状态创建任务", () => {
      const taskId = "test_1234567890_abc123";
      const toolName = "testTool";
      const args = { input: "data" };

      const task = manager.createTask(taskId, toolName, args, "completed");

      expect(task.status).toBe("completed");
    });

    it("应该拒绝创建重复的任务ID", () => {
      const taskId = "test_1234567890_abc123";
      const toolName = "testTool";
      const args = { input: "data" };

      manager.createTask(taskId, toolName, args);

      expect(() => {
        manager.createTask(taskId, toolName, args);
      }).toThrow("任务已存在: test_1234567890_abc123");
    });
  });

  describe("任务状态更新", () => {
    let taskId: string;

    beforeEach(() => {
      taskId = "test_1234567890_abc123";
      manager.createTask(taskId, "testTool", { input: "data" });
    });

    it("应该更新任务状态", () => {
      const result = manager.updateTaskStatus(taskId, "completed");

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `[TaskState] 更新任务状态: ${taskId} pending -> completed`
        )
      );
    });

    it("应该为完成状态设置结束时间", () => {
      manager.updateTaskStatus(taskId, "completed");
      const task = manager.getTask(taskId);

      expect(task?.endTime).toBeDefined();
    });

    it("应该为失败状态设置结束时间", () => {
      manager.updateTaskStatus(taskId, "failed", undefined, "测试错误");
      const task = manager.getTask(taskId);

      expect(task?.endTime).toBeDefined();
    });

    it("应该设置结果和错误信息", () => {
      const resultData = { output: "success" };
      const errorMessage = "执行失败";

      manager.updateTaskStatus(taskId, "completed", resultData);
      const task = manager.getTask(taskId);

      expect(task?.result).toBe(resultData);
      expect(task?.error).toBeUndefined();

      manager.updateTaskStatus(taskId, "failed", undefined, errorMessage);
      const failedTask = manager.getTask(taskId);

      expect(failedTask?.result).toBeDefined();
      expect(failedTask?.error).toBe(errorMessage);
    });

    it("应该处理不存在的任务ID", () => {
      const result = manager.updateTaskStatus("nonexistent_task", "completed");

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[TaskState] 任务不存在: nonexistent_task"
      );
    });
  });

  describe("任务状态标记方法", () => {
    let taskId: string;

    beforeEach(() => {
      taskId = "test_1234567890_abc123";
    });

    it("应该标记任务为处理中", () => {
      const task = manager.markTaskAsPending(taskId, "testTool", {
        input: "data",
      });

      expect(task.taskId).toBe(taskId);
      expect(task.status).toBe("pending");
      expect(task.toolName).toBe("testTool");
    });

    it("应该更新现有任务为处理中状态", () => {
      manager.createTask(taskId, "testTool", { input: "data" }, "completed");
      const task = manager.markTaskAsPending(taskId, "testTool", {
        input: "data",
      });

      expect(task.status).toBe("pending");
    });

    it("应该标记任务为已完成", () => {
      manager.createTask(taskId, "testTool", { input: "data" });
      const result = manager.markTaskAsCompleted(taskId, { output: "success" });

      expect(result).toBe(true);
      const task = manager.getTask(taskId);
      expect(task?.status).toBe("completed");
      expect(task?.result).toEqual({ output: "success" });
    });

    it("应该标记任务为失败", () => {
      manager.createTask(taskId, "testTool", { input: "data" });
      const result = manager.markTaskAsFailed(taskId, "测试错误");

      expect(result).toBe(true);
      const task = manager.getTask(taskId);
      expect(task?.status).toBe("failed");
      expect(task?.error).toBe("测试错误");
    });

    it("应该标记任务为已消费", () => {
      manager.createTask(taskId, "testTool", { input: "data" });
      const result = manager.markTaskAsConsumed(taskId);

      expect(result).toBe(true);
      const task = manager.getTask(taskId);
      expect(task?.status).toBe("consumed");
    });
  });

  describe("任务查询", () => {
    let taskIds: string[];

    beforeEach(() => {
      taskIds = [
        manager.generateTaskId("tool1", { data: 1 }),
        manager.generateTaskId("tool2", { data: 2 }),
        manager.generateTaskId("tool1", { data: 3 }),
      ];

      manager.createTask(taskIds[0], "tool1", { data: 1 }, "pending");
      manager.createTask(taskIds[1], "tool2", { data: 2 }, "completed");
      manager.createTask(taskIds[2], "tool1", { data: 3 }, "failed");
    });

    it("应该获取任务信息", () => {
      const task = manager.getTask(taskIds[0]);

      expect(task).toBeDefined();
      expect(task?.taskId).toBe(taskIds[0]);
      expect(task?.toolName).toBe("tool1");
    });

    it("应该为不存在的任务返回null", () => {
      const task = manager.getTask("nonexistent_task");
      expect(task).toBeNull();
    });

    it("应该检查任务是否存在", () => {
      expect(manager.hasTask(taskIds[0])).toBe(true);
      expect(manager.hasTask("nonexistent_task")).toBe(false);
    });

    it("应该获取任务状态", () => {
      expect(manager.getTaskStatus(taskIds[0])).toBe("pending");
      expect(manager.getTaskStatus(taskIds[1])).toBe("completed");
      expect(manager.getTaskStatus("nonexistent_task")).toBeNull();
    });

    it("应该按状态获取任务列表", () => {
      const pendingTasks = manager.getTasksByStatus("pending");
      const completedTasks = manager.getTasksByStatus("completed");
      const failedTasks = manager.getTasksByStatus("failed");

      expect(pendingTasks).toHaveLength(1);
      expect(pendingTasks[0].taskId).toBe(taskIds[0]);

      expect(completedTasks).toHaveLength(1);
      expect(completedTasks[0].taskId).toBe(taskIds[1]);

      expect(failedTasks).toHaveLength(1);
      expect(failedTasks[0].taskId).toBe(taskIds[2]);
    });

    it("应该按工具名称获取任务列表", () => {
      const tool1Tasks = manager.getTasksByTool("tool1");
      const tool2Tasks = manager.getTasksByTool("tool2");

      expect(tool1Tasks).toHaveLength(2);
      expect(tool2Tasks).toHaveLength(1);
      expect(tool2Tasks[0].taskId).toBe(taskIds[1]);
    });

    it("应该为不存在的工具返回空列表", () => {
      const tasks = manager.getTasksByTool("nonexistent_tool");
      expect(tasks).toHaveLength(0);
    });
  });

  describe("任务执行时间", () => {
    let taskId: string;

    beforeEach(() => {
      taskId = "test_1234567890_abc123";
      manager.createTask(taskId, "testTool", { input: "data" });
    });

    it("应该获取任务执行时间", () => {
      // 模拟时间延迟
      vi.advanceTimersByTime(1000);
      manager.updateTaskStatus(taskId, "completed");

      const executionTime = manager.getTaskExecutionTime(taskId);

      expect(executionTime).toBeGreaterThanOrEqual(1000);
      expect(executionTime).toBeLessThanOrEqual(2000); // 允许一些误差
    });

    it("应该为未完成的任务返回null", () => {
      const executionTime = manager.getTaskExecutionTime(taskId);
      expect(executionTime).toBeNull();
    });

    it("应该为不存在的任务返回null", () => {
      const executionTime = manager.getTaskExecutionTime("nonexistent_task");
      expect(executionTime).toBeNull();
    });
  });

  describe("超时检测", () => {
    let taskId: string;

    beforeEach(() => {
      taskId = "test_1234567890_abc123";
      manager.createTask(taskId, "testTool", { input: "data" });
    });

    it("应该检测超时的任务", () => {
      // 模拟时间超过默认超时时间
      vi.advanceTimersByTime(9000);

      expect(manager.isTaskTimeout(taskId)).toBe(true);
    });

    it("应该使用自定义超时时间", () => {
      // 使用较短的超时时间
      vi.advanceTimersByTime(2000);

      expect(manager.isTaskTimeout(taskId, 1000)).toBe(true);
      expect(manager.isTaskTimeout(taskId, 5000)).toBe(false);
    });

    it("应该为不存在的任务返回false", () => {
      expect(manager.isTaskTimeout("nonexistent_task")).toBe(false);
    });

    it("应该获取超时任务列表", () => {
      // 创建多个任务
      const taskId2 = "test2_1234567890_abc123";
      manager.createTask(taskId2, "testTool2", { input: "data2" });

      // 完成其中一个任务
      manager.updateTaskStatus(taskId2, "completed");

      // 模拟时间超时
      vi.advanceTimersByTime(9000);

      const timeoutTasks = manager.getTimeoutTasks();

      expect(timeoutTasks).toHaveLength(1);
      expect(timeoutTasks[0].taskId).toBe(taskId);
      expect(timeoutTasks[0].status).toBe("pending");
    });
  });

  describe("任务移除", () => {
    let taskId: string;

    beforeEach(() => {
      taskId = "test_1234567890_abc123";
      manager.createTask(taskId, "testTool", { input: "data" });
    });

    it("应该移除存在的任务", () => {
      const result = manager.removeTask(taskId);

      expect(result).toBe(true);
      expect(manager.hasTask(taskId)).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`[TaskState] 移除任务: ${taskId}`)
      );
    });

    it("应该处理移除不存在的任务", () => {
      const result = manager.removeTask("nonexistent_task");

      expect(result).toBe(false);
    });
  });

  describe("任务清理", () => {
    beforeEach(() => {
      // 创建不同状态的任务
      const now = Date.now();

      // 创建已完成任务（应该被清理）
      const completedTaskId = "completed_1234567890_abc123";
      manager.createTask(completedTaskId, "tool1", { data: 1 }, "completed");

      // 手动设置完成时间为较早的时间
      const completedTask = manager.getTask(completedTaskId);
      if (completedTask) {
        completedTask.endTime = new Date(now - 400000).toISOString(); // 400秒前
      }

      // 创建失败任务（应该被清理）
      const failedTaskId = "failed_1234567890_abc123";
      manager.createTask(failedTaskId, "tool2", { data: 2 }, "failed");

      const failedTask = manager.getTask(failedTaskId);
      if (failedTask) {
        failedTask.endTime = new Date(now - 400000).toISOString();
      }

      // 创建进行中的任务（不应该被清理）
      const pendingTaskId = "pending_1234567890_abc123";
      manager.createTask(pendingTaskId, "tool3", { data: 3 }, "pending");

      // 创建最近完成的任务（不应该被清理）
      const recentTaskId = "recent_1234567890_abc123";
      manager.createTask(recentTaskId, "tool4", { data: 4 }, "completed");

      const recentTask = manager.getTask(recentTaskId);
      if (recentTask) {
        recentTask.endTime = new Date(now - 100000).toISOString(); // 100秒前
      }
    });

    it("应该清理已完成的任务", () => {
      const cleanedCount = manager.cleanupCompletedTasks(300000); // 5分钟

      expect(cleanedCount).toBe(2); // 应该清理2个任务
      expect(manager.hasTask("completed_1234567890_abc123")).toBe(false);
      expect(manager.hasTask("failed_1234567890_abc123")).toBe(false);
      expect(manager.hasTask("pending_1234567890_abc123")).toBe(true);
      expect(manager.hasTask("recent_1234567890_abc123")).toBe(true);

      expect(mockLogger.info).toHaveBeenCalledWith(
        "[TaskState] 清理已完成任务: 2个"
      );
    });

    it("应该使用默认的清理时间", () => {
      const cleanedCount = manager.cleanupCompletedTasks();

      expect(cleanedCount).toBeGreaterThanOrEqual(0);
      expect(cleanedCount).toBeLessThanOrEqual(4);
    });
  });

  describe("任务统计", () => {
    beforeEach(() => {
      // 创建不同状态的任务用于测试统计
      const taskIds = [
        manager.generateTaskId("tool1", { data: 1 }),
        manager.generateTaskId("tool2", { data: 2 }),
        manager.generateTaskId("tool1", { data: 3 }),
        manager.generateTaskId("tool3", { data: 4 }),
        manager.generateTaskId("tool2", { data: 5 }),
      ];

      manager.createTask(taskIds[0], "tool1", { data: 1 }, "pending");
      manager.createTask(taskIds[1], "tool2", { data: 2 }, "completed");
      manager.createTask(taskIds[2], "tool1", { data: 3 }, "completed");
      manager.createTask(taskIds[3], "tool3", { data: 4 }, "failed");
      manager.createTask(taskIds[4], "tool2", { data: 5 }, "consumed");

      // 为已完成的任务设置执行时间
      vi.advanceTimersByTime(1000);
      manager.updateTaskStatus(taskIds[1], "completed", { result: "success1" });

      vi.advanceTimersByTime(2000);
      manager.updateTaskStatus(taskIds[2], "completed", { result: "success2" });
    });

    it("应该获取任务统计信息", () => {
      const stats = manager.getTaskStatistics();

      expect(stats.total).toBe(5);
      expect(stats.pending).toBe(1);
      expect(stats.completed).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.consumed).toBe(1);
      expect(stats.averageExecutionTime).toBeGreaterThan(0);
    });

    it("应该在没有完成任务时返回0平均执行时间", () => {
      // 清空管理器
      manager.cleanup();

      const stats = manager.getTaskStatistics();

      expect(stats.total).toBe(0);
      expect(stats.averageExecutionTime).toBe(0);
    });
  });

  describe("任务历史记录", () => {
    let taskId: string;

    beforeEach(() => {
      taskId = "test_1234567890_abc123";
      manager.createTask(taskId, "testTool", { input: "data" });
    });

    it("应该记录任务历史", () => {
      manager.updateTaskStatus(taskId, "completed");
      manager.updateTaskStatus(taskId, "consumed");

      const history = manager.getTaskHistory(taskId);

      expect(history).toHaveLength(3); // 创建 -> 完成 -> 消费
      expect(history[0].from).toBe("none");
      expect(history[0].to).toBe("pending");
      expect(history[1].from).toBe("pending");
      expect(history[1].to).toBe("completed");
      expect(history[2].from).toBe("completed");
      expect(history[2].to).toBe("consumed");
    });

    it("应该获取所有任务历史", () => {
      const taskId2 = "test2_1234567890_abc123";
      manager.createTask(taskId2, "testTool2", { input: "data2" });

      manager.updateTaskStatus(taskId, "completed");
      manager.updateTaskStatus(taskId2, "failed");

      const allHistory = manager.getTaskHistory();

      expect(allHistory.length).toBeGreaterThan(2);
      expect(allHistory.some((h) => h.taskId === taskId)).toBe(true);
      expect(allHistory.some((h) => h.taskId === taskId2)).toBe(true);
    });

    it("应该限制历史记录数量防止内存泄漏", () => {
      // 创建大量状态转换
      for (let i = 0; i < 1100; i++) {
        const taskId = `task_${i}_1234567890_abc123`;
        manager.createTask(taskId, "tool", { data: i });
        manager.updateTaskStatus(taskId, "completed");
      }

      const history = manager.getTaskHistory();
      expect(history.length).toBeLessThanOrEqual(1000);
    });
  });

  describe("数据完整性验证", () => {
    it("应该验证完整的任务数据", () => {
      const taskId = "test_1234567890_abc123";
      manager.createTask(taskId, "testTool", { input: "data" }, "completed");

      // 更新状态以设置结束时间
      manager.updateTaskStatus(taskId, "completed");

      const validation = manager.validateTaskIntegrity();

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it("应该检测缺少必需字段的任务", () => {
      // 手动创建损坏的任务
      const badTask = {
        taskId: "bad_task",
        // 缺少 toolName
        status: "pending",
        startTime: new Date().toISOString(),
      };

      // 使用反射设置损坏的任务
      (manager as any).activeTasks.set("bad_task", badTask);

      const validation = manager.validateTaskIntegrity();

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain("任务缺少必需字段: bad_task");
    });

    it("应该检测无效的时间戳", () => {
      const taskId = "test_1234567890_abc123";
      manager.createTask(taskId, "testTool", { input: "data" });

      // 手动设置损坏的时间戳
      const task = manager.getTask(taskId);
      if (task) {
        task.startTime = "invalid-date";
      }

      const validation = manager.validateTaskIntegrity();

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain(`无效的开始时间: ${taskId}`);
    });

    it("应该检测已完成任务缺少结束时间", () => {
      const taskId = "test_1234567890_abc123";
      manager.createTask(taskId, "testTool", { input: "data" }, "completed");

      // 移除结束时间
      const task = manager.getTask(taskId);
      if (task) {
        task.endTime = undefined;
      }

      const validation = manager.validateTaskIntegrity();

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain(`已完成任务缺少结束时间: ${taskId}`);
    });

    it("应该检测失败任务缺少错误信息", () => {
      const taskId = "test_1234567890_abc123";
      manager.createTask(taskId, "testTool", { input: "data" }, "failed");

      // 移除错误信息
      const task = manager.getTask(taskId);
      if (task) {
        task.error = undefined;
      }

      const validation = manager.validateTaskIntegrity();

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain(`失败任务缺少错误信息: ${taskId}`);
    });
  });

  describe("停滞任务重启", () => {
    it("应该重启停滞的任务", () => {
      const taskId = "stalled_1234567890_abc123";
      const toolName = "stalledTool";
      const args = { input: "data" };

      manager.createTask(taskId, toolName, args, "pending");

      // 模拟时间超过停滞阈值
      vi.advanceTimersByTime(35000);

      const restartedCount = manager.restartStalledTasks(30000);

      expect(restartedCount).toBe(1);

      // 原任务应该被标记为失败
      const originalTask = manager.getTask(taskId);
      expect(originalTask?.status).toBe("failed");
      expect(originalTask?.error).toBe("任务执行超时");

      // 应该创建新的任务
      const tasks = manager.getTasksByTool(toolName);
      const newTask = tasks.find((t) => t.taskId !== taskId);
      expect(newTask).toBeDefined();
      expect(newTask?.status).toBe("pending");
    });

    it("应该使用默认的停滞时间", () => {
      const taskId = "stalled_1234567890_abc123";
      manager.createTask(taskId, "stalledTool", { input: "data" }, "pending");

      vi.advanceTimersByTime(35000);

      const restartedCount = manager.restartStalledTasks();

      expect(restartedCount).toBe(1);
    });

    it("应该不处理未停滞的任务", () => {
      const taskId = "active_1234567890_abc123";
      manager.createTask(taskId, "activeTool", { input: "data" }, "pending");

      vi.advanceTimersByTime(10000); // 10秒，未超过30秒默认停滞时间

      const restartedCount = manager.restartStalledTasks();

      expect(restartedCount).toBe(0);
      const task = manager.getTask(taskId);
      expect(task?.status).toBe("pending");
    });
  });

  describe("资源清理", () => {
    it("应该清理所有资源", () => {
      // 创建一些任务
      const taskId = "test_1234567890_abc123";
      manager.createTask(taskId, "testTool", { input: "data" });

      manager.cleanup();

      expect(manager.hasTask(taskId)).toBe(false);
      expect(manager.getTaskHistory()).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[TaskState] 清理任务状态管理器资源"
      );
    });

    it("应该可以多次调用cleanup而不出错", () => {
      manager.cleanup();
      manager.cleanup(); // 第二次调用
      manager.cleanup(); // 第三次调用

      // 应该没有错误抛出
      expect(true).toBe(true);
    });
  });

  describe("边界条件和错误处理", () => {
    it("应该处理空字符串任务ID", () => {
      expect(manager.validateTaskId("")).toBe(false);
      expect(manager.extractToolName("")).toBeNull();
      expect(manager.getTask("")).toBeNull();
      expect(manager.hasTask("")).toBe(false);
      expect(manager.getTaskStatus("")).toBeNull();
    });

    it("应该处理null和undefined参数", () => {
      // 这些方法应该能处理null/undefined参数而不崩溃
      expect(manager.validateTaskId(null as any)).toBe(false);
      expect(manager.extractToolName(null as any)).toBeNull();
      expect(manager.getTask(null as any)).toBeNull();
      expect(manager.hasTask(null as any)).toBe(false);
      expect(manager.getTaskStatus(null as any)).toBeNull();
    });

    it("应该处理复杂的参数对象", () => {
      const complexArgs = {
        nested: {
          array: [1, 2, 3],
          object: { a: 1, b: 2 },
        },
        date: new Date(),
        regex: /test/,
        function: () => {},
      };

      const taskId = manager.generateTaskId("complexTool", complexArgs);
      expect(taskId).toBeDefined();
      expect(manager.validateTaskId(taskId)).toBe(true);
    });

    it("应该处理超长工具名称", () => {
      const longToolName = "a".repeat(1000);
      const taskId = manager.generateTaskId(longToolName, { data: 1 });

      expect(taskId.startsWith(longToolName)).toBe(true);
      expect(manager.validateTaskId(taskId)).toBe(true);
      expect(manager.extractToolName(taskId)).toBe(longToolName);
    });
  });

  describe("状态转换原因", () => {
    let taskId: string;

    beforeEach(() => {
      taskId = "test_1234567890_abc123";
      manager.createTask(taskId, "testTool", { input: "data" });
    });

    it("应该为不同的状态转换提供正确的原因", () => {
      manager.updateTaskStatus(taskId, "completed");
      manager.updateTaskStatus(taskId, "consumed");

      const history = manager.getTaskHistory(taskId);

      expect(history[1].reason).toBe("任务执行成功");
      expect(history[2].reason).toBe("结果被消费");
    });

    it("应该为失败状态提供错误信息", () => {
      const errorMessage = "测试失败原因";
      manager.updateTaskStatus(taskId, "failed", undefined, errorMessage);

      const history = manager.getTaskHistory(taskId);
      const failedTransition = history.find((h) => h.to === "failed");

      expect(failedTransition?.reason).toBe(`执行失败: ${errorMessage}`);
    });

    it("应该为未知状态转换提供默认原因", () => {
      // 直接修改内部状态来测试未知转换
      const task = manager.getTask(taskId);
      if (task) {
        task.status = "unknown" as any;
      }

      manager.updateTaskStatus(taskId, "completed");

      const history = manager.getTaskHistory(taskId);
      const unknownTransition = history.find(
        (h) => h.from === ("unknown" as TaskStatus)
      );

      expect(unknownTransition?.reason).toBe("状态更新");
    });
  });
});
