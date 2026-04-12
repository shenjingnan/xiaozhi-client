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

/**
 * ASR 服务配置选项（backend 包特定）
 * 扩展基础选项
 */
export interface ASRServiceOptions extends BaseASRServiceOptions {}