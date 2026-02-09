import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  /** 图标组件 */
  icon?: ReactNode;
  /** 标题文本 */
  title: string;
  /** 描述文本 */
  description?: string;
  /** 操作按钮或其他操作元素 */
  action?: ReactNode;
  /** 额外的类名 */
  className?: string;
}

/**
 * 空状态组件
 *
 * 用于在列表、表格或其他内容区域显示空状态提示。
 * 支持自定义图标、标题、描述和操作按钮。
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon={<Workflow className="h-12 w-12 text-muted-foreground" />}
 *   title="暂无工作流"
 *   description="当前工作空间下没有可用的工作流"
 * />
 * ```
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className
      )}
    >
      {icon && <div className="mb-4">{icon}</div>}
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}
