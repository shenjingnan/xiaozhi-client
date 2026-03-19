/**
 * Node.js MaxListeners 设置脚本
 *
 * 用于解决 nx 构建过程中出现的 MaxListenersExceededWarning 警告
 *
 * 问题原因：
 * - nx run-many 命令会并行运行多个任务
 * - 每个子进程为 process 对象添加 SIGINT/SIGTERM/SIGHUP 监听器
 * - 默认 maxListeners 限制为 10，实际需要 12+
 *
 * 使用方式：
 * 通过 NODE_OPTIONS 环境变量加载此脚本：
 * NODE_OPTIONS="--require ./scripts/max-listeners-setup.js" nx run-many ...
 */

// 增加 process 对象的事件监听器限制
// nx 并行任务可能注册超过 10 个信号监听器
process.setMaxListeners(20);

// 同时增加 EventEmitter 的默认限制
const { EventEmitter } = require("node:events");
EventEmitter.defaultMaxListeners = 20;
