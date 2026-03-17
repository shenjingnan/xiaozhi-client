/**
 * 业务服务层模块
 *
 * 提供后端核心业务服务，包括：
 * - StatusService: 统一的状态管理服务，管理客户端连接状态、MCP 服务状态等
 * - NotificationService: 通知服务，处理系统通知和消息推送
 * - EventBus / getEventBus: 事件总线服务，提供发布-订阅模式的事件处理机制
 * - ASRService: 语音识别服务，处理语音到文本的转换
 * - TTSService: 语音合成服务，处理文本到语音的转换
 * - LLMService: 大语言模型服务，提供 AI 对话能力
 * - DeviceRegistryService: 设备注册服务，管理设备连接和状态
 * - ESP32Service: ESP32 设备服务，处理 ESP32 硬件通信
 * - CustomMCPHandler: 自定义 MCP 处理器（重新导出，保持向后兼容性）
 *
 * @example
 * ```typescript
 * import { StatusService, NotificationService, getEventBus, ASRService, TTSService, LLMService } from '@/services';
 *
 * // 使用状态服务
 * const statusService = new StatusService();
 * const status = statusService.getFullStatus();
 *
 * // 使用事件总线
 * const eventBus = getEventBus();
 * eventBus.onEvent('event-name', (data) => {
 *   console.log('Event received:', data);
 * });
 *
 * // 使用 ASR 服务
 * const asrService = new ASRService();
 * await asrService.prepare('device-001');
 *
 * // 使用 TTS 服务
 * const ttsService = new TTSService();
 * await ttsService.speak('device-001', '你好');
 *
 * // 使用 LLM 服务
 * const llmService = new LLMService();
 * const response = await llmService.chat('你好');
 * ```
 */
export * from "./status.service.js";
export * from "./notification.service.js";
export * from "./event-bus.service.js";
export * from "./device-registry.service.js";
export * from "./esp32.service.js";
export * from "./asr.service.js";
export * from "./tts.service.js";
export * from "./llm.service.js";

// CustomMCPHandler 重新导出 - 保持向后兼容性
export { CustomMCPHandler } from "@/lib/mcp/custom.js";
