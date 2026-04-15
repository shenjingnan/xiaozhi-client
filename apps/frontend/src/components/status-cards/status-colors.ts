/**
 * 状态卡片颜色常量
 *
 * 用于 MiniCircularProgress 组件的状态指示颜色定义。
 * 统一管理状态颜色，避免硬编码，便于维护和主题适配。
 */

/**
 * 成功/激活状态颜色（绿色）
 */
export const STATUS_COLOR_SUCCESS = "#16a34a";

/**
 * 失败/非激活状态颜色（红色）
 */
export const STATUS_COLOR_ERROR = "#f87171";

/**
 * 警告/部分完成状态颜色（橙色）
 */
export const STATUS_COLOR_WARNING = "#f59e0b";

/**
 * 非激活背景颜色（灰色）
 */
export const STATUS_COLOR_INACTIVE = "#e5e7eb";

/**
 * 根据完成率返回对应状态颜色
 *
 * @param rate - 完成率（0-1之间的数值）
 * @returns 对应状态的颜色值
 *
 * @example
 * ```ts
 * getStatusColorByRate(1.0)   // 返回 "#16a34a" (成功)
 * getStatusColorByRate(0.8)   // 返回 "#16a34a" (成功)
 * getStatusColorByRate(0.66)  // 返回 "#f59e0b" (警告)
 * getStatusColorByRate(0.5)   // 返回 "#f59e0b" (警告)
 * getStatusColorByRate(0.3)   // 返回 "#f87171" (失败)
 * ```
 */
export function getStatusColorByRate(rate: number): string {
  if (rate >= 0.8) return STATUS_COLOR_SUCCESS;
  if (rate >= 0.5) return STATUS_COLOR_WARNING;
  return STATUS_COLOR_ERROR;
}
