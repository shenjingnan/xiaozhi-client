/**
 * ASR 服务接口
 * 重新导出共享接口并定义包特定的配置选项
 */

// 从 shared-types 重新导出共享接口
export type {
  ASRServiceEvents,
  IASRService,
} from "@xiaozhi-client/shared-types/services";

// 从 shared-types 导入基础选项用于扩展
import type { BaseASRServiceOptions } from "@xiaozhi-client/shared-types/services";
import type { ILogger, IESP32ConfigProvider } from "../interfaces.js";

/**
 * ASR 服务配置选项（ESP32 包特定）
 * 扩展基础选项，添加日志器和配置提供者
 */
export interface ASRServiceOptions extends BaseASRServiceOptions {
  /**
   * 日志器（可选）
   */
  logger?: ILogger;

  /**
   * 配置提供者（可选，用于获取 ASR 配置）
   */
  configProvider?: IESP32ConfigProvider;
}