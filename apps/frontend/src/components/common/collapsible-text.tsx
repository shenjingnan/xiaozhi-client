"use client";

import { cn } from "@/lib/utils";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * CollapsibleText 组件属性
 */
interface CollapsibleTextProps {
  /** 要展示的文本 */
  text: string;
  /** 最大展示字数（默认：100） */
  maxLength?: number;
  /** localStorage 存储键（可选，不传则不持久化） */
  storageKey?: string;
  /** 自定义样式类 */
  className?: string;
  /** 文字大小（默认：text-sm） */
  textSize?: "text-xs" | "text-sm" | "text-base" | "text-lg" | "text-xl";
}

/**
 * CollapsibleText - 通用文本折叠/展开组件
 *
 * 功能：
 * - 可设定最大展示字数
 * - 超过部分隐藏，显示省略号
 * - 显示"展开"按钮，点击后展示完整内容
 * - 展开后显示"收起"按钮，点击恢复折叠状态
 * - 支持使用 localStorage 持久化展开/收起状态
 */
export function CollapsibleText({
  text,
  maxLength = 100,
  storageKey,
  className,
  textSize = "text-sm",
}: CollapsibleTextProps) {
  // 从 localStorage 读取初始状态
  const getInitialExpandedState = (): boolean => {
    if (!storageKey) return false;

    try {
      const stored = localStorage.getItem(storageKey);
      return stored === "true";
    } catch {
      return false;
    }
  };

  const [isExpanded, setIsExpanded] = useState<boolean>(
    getInitialExpandedState
  );

  // 状态变化时写入 localStorage
  useEffect(() => {
    if (!storageKey) return;

    try {
      localStorage.setItem(storageKey, String(isExpanded));
    } catch (error) {
      console.warn("无法写入 localStorage:", error);
    }
  }, [isExpanded, storageKey]);

  // 切换展开/收起状态
  const toggleExpanded = () => {
    setIsExpanded((prev) => !prev);
  };

  // 空文本处理
  const displayText = text || "-";

  // 判断是否需要折叠
  const needsCollapsing = displayText.length > maxLength;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {/* 文本内容 */}
      {isExpanded || !needsCollapsing ? (
        <p className={cn("break-words", textSize)}>{displayText}</p>
      ) : (
        <p className={cn("break-words", textSize)}>
          {displayText.slice(0, maxLength)}
          <span className="text-muted-foreground">...</span>
        </p>
      )}

      {/* 展开/收起按钮 */}
      {needsCollapsing && (
        <button
          type="button"
          onClick={toggleExpanded}
          className={cn(
            "text-primary hover:underline flex items-center gap-1 w-fit",
            textSize
          )}
        >
          {isExpanded ? (
            <>
              收起 <ChevronUpIcon className="h-4 w-4" />
            </>
          ) : (
            <>
              展开 <ChevronDownIcon className="h-4 w-4" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
