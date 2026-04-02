/**
 * CopyButton 组件 - 统一的复制功能组件
 *
 * 功能：
 * - 提供统一的复制到剪贴板功能
 * - 支持可选的 toast 提示
 * - 支持传统复制方法的降级方案
 * - 支持可选的文本标签显示
 * - 组件卸载时自动清理定时器
 *
 * @module apps/frontend/src/components/common/copy-button
 */

"use client";

import { Button } from "@/components/ui/button";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface CopyButtonProps {
  /** 要复制的内容 */
  content: string;
  /** 按钮大小 */
  size?: "sm" | "default" | "lg" | "icon";
  /** 是否显示 toast 提示 */
  showToast?: boolean;
  /** 复制成功的提示消息 */
  successMessage?: string;
  /** 复制失败的提示消息 */
  errorMessage?: string;
  /** 是否使用 execCommand 降级方案 */
  fallback?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 按钮变体样式 */
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  /** 复制成功状态的持续时间（毫秒） */
  duration?: number;
  /** 按钮标题（tooltip） */
  title?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否显示文本标签 */
  showText?: boolean;
  /** 未复制时的文本标签 */
  copyLabel?: string;
  /** 已复制时的文本标签 */
  copiedLabel?: string;
}

/**
 * 统一的复制按钮组件
 *
 * @param props - 组件属性
 * @returns 复制按钮组件
 */
export function CopyButton({
  content,
  size = "sm",
  showToast = false,
  successMessage = "已复制到剪贴板",
  errorMessage = "复制失败",
  fallback = false,
  className = "",
  variant = "ghost",
  duration = 2000,
  title,
  disabled = false,
  showText = false,
  copyLabel = "复制",
  copiedLabel = "已复制",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = async () => {
    try {
      // 优先使用现代 Clipboard API
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else if (fallback) {
        // 降级方案：使用传统的复制方法
        const textArea = document.createElement("textarea");
        textArea.value = content;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (!successful) {
          throw new Error("复制命令执行失败");
        }
      } else {
        throw new Error("不支持复制功能");
      }

      setCopied(true);

      if (showToast) {
        toast.success(successMessage);
      }

      // 清除之前的定时器
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }

      // 设置定时器，自动恢复状态
      copiedTimerRef.current = setTimeout(() => {
        setCopied(false);
      }, duration);
    } catch (error) {
      if (showToast) {
        toast.error(errorMessage);
      }
      console.error("复制失败:", error);
    }
  };

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  return (
    <Button
      variant={variant}
      size={size}
      className={`${className} ${
        copied ? "text-green-600 hover:text-green-700" : ""
      }`}
      onClick={handleCopy}
      title={title}
      disabled={disabled}
    >
      {showText ? (
        <>
          {copied ? (
            <>
              <CheckIcon className="h-4 w-4 mr-1" />
              {copiedLabel}
            </>
          ) : (
            <>
              <CopyIcon className="h-4 w-4 mr-1" />
              {copyLabel}
            </>
          )}
        </>
      ) : (
        copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />
      )}
    </Button>
  );
}