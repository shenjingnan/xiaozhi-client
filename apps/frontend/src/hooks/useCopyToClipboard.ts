import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * 复制到剪贴板功能的配置选项
 */
interface UseCopyToClipboardOptions {
  /** 是否显示成功提示 */
  showToast?: boolean;
  /** 成功提示的消息内容 */
  toastMessage?: string;
  /** 复制成功状态重置的延迟时间（毫秒），0 表示不自动重置 */
  successDuration?: number;
}

/**
 * 复制到剪贴板功能的返回值
 */
interface UseCopyToClipboardReturn {
  /** 是否已复制 */
  copied: boolean;
  /** 错误信息 */
  error: string | null;
  /** 复制函数 */
  copy: (text: string) => Promise<void>;
}

/**
 * 复制到剪贴板 Hook
 *
 * 提供统一的复制到剪贴板功能，支持：
 * - 现代 Clipboard API 优先，降级到 execCommand
 * - 可选的 Toast 通知
 * - 可配置的成功状态持续时间
 * - 完善的错误处理
 * - 自动清理定时器
 *
 * @example
 * ```tsx
 * // 基础使用 - 仅复制，无通知
 * const { copied, copy } = useCopyToClipboard();
 *
 * // 带 Toast 通知
 * const { copied, copy } = useCopyToClipboard({
 *   showToast: true,
 *   toastMessage: "已复制到剪贴板",
 * });
 *
 * // 自定义成功状态持续时间
 * const { copied, copy } = useCopyToClipboard({
 *   showToast: true,
 *   successDuration: 3000,
 * });
 * ```
 */
export function useCopyToClipboard(
  options: UseCopyToClipboardOptions = {}
): UseCopyToClipboardReturn {
  const {
    showToast = false,
    toastMessage = "已复制到剪贴板",
    successDuration = 0,
  } = options;

  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(
    async (text: string) => {
      setError(null);

      try {
        // 优先使用现代 Clipboard API
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          // 降级方案：使用传统的 execCommand 方法
          const textArea = document.createElement("textarea");
          textArea.value = text;
          textArea.style.position = "fixed";
          textArea.style.opacity = "0";
          document.body.appendChild(textArea);
          textArea.select();
          const successful = document.execCommand("copy");
          document.body.removeChild(textArea);

          if (!successful) {
            throw new Error("复制命令执行失败");
          }
        }

        setCopied(true);

        // 显示 Toast 通知（如果启用）
        if (showToast) {
          toast.success(toastMessage);
        }

        // 清除之前的定时器
        if (copiedTimerRef.current) {
          clearTimeout(copiedTimerRef.current);
        }

        // 自动恢复状态（如果设置了持续时间）
        if (successDuration > 0) {
          copiedTimerRef.current = setTimeout(() => {
            setCopied(false);
          }, successDuration);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "复制失败";
        setError(errorMessage);
        console.error("复制失败:", err);
      }
    },
    [showToast, toastMessage, successDuration]
  );

  // 清理定时器
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  return { copied, error, copy };
}
