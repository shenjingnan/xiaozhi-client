"use client";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { apiClient } from "@/services/api";
import type { CustomMCPToolWithStats } from "@xiaozhi-client/shared-types";
import { Check, Loader2, Search, ZapIcon } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * 格式化工具信息的接口
 */
interface FormattedTool {
  name: string;
  serverName: string;
  toolName: string;
  description: string;
  enabled: boolean;
  inputSchema: any;
}

/**
 * 命令面板属性接口
 */
interface CommandPaletteProps {
  /** 命令面板是否打开 */
  open: boolean;
  /** 命令面板打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 工具选中回调 */
  onToolSelect: (tool: FormattedTool) => void;
}

/**
 * 服务名称常量
 */
const UNKNOWN_SERVICE_NAME = "未知服务";
const CUSTOM_SERVICE_NAME = "自定义服务";

/**
 * 单个工具列表项组件
 */
interface ToolListItemProps {
  tool: FormattedTool;
  isSelected: boolean;
  onClick: () => void;
}

const ToolListItem = memo(function ToolListItem({
  tool,
  isSelected,
  onClick,
}: ToolListItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 px-3 py-2 text-left rounded-md transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus:bg-accent focus:text-accent-foreground focus:outline-none",
        isSelected && "bg-accent text-accent-foreground"
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        <ZapIcon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs flex-shrink-0">
            {tool.serverName}
          </Badge>
          <span className="font-medium text-sm truncate">{tool.toolName}</span>
        </div>
        {tool.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {tool.description}
          </p>
        )}
      </div>
      {isSelected && (
        <Check className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      )}
    </button>
  );
});

/**
 * 命令面板组件
 *
 * 功能特性：
 * - 快捷键唤起：Cmd+K (Mac) / Ctrl+K (Windows/Linux)
 * - 实时搜索：按服务名、工具名、描述进行模糊搜索
 * - 键盘导航：上下键选择、回车确认、ESC 关闭
 * - 工具调试：选中工具后回车唤起调试对话框
 */
export function CommandPalette({
  open,
  onOpenChange,
  onToolSelect,
}: CommandPaletteProps) {
  const [searchValue, setSearchValue] = useState("");
  const [tools, setTools] = useState<FormattedTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /**
   * 格式化工具信息
   */
  const formatTool = useCallback(
    (tool: CustomMCPToolWithStats): FormattedTool => {
      const { serviceName, toolName } = (() => {
        if (!tool || !tool.handler) {
          return {
            serviceName: UNKNOWN_SERVICE_NAME,
            toolName: tool?.name || UNKNOWN_SERVICE_NAME,
          };
        }

        if (tool.handler.type === "mcp") {
          return {
            serviceName:
              tool.handler.config?.serviceName || UNKNOWN_SERVICE_NAME,
            toolName: tool.handler.config?.toolName || tool.name,
          };
        }
        if (tool.handler.type === "proxy" && tool.handler.platform === "coze") {
          return {
            serviceName: "customMCP",
            toolName: tool.name,
          };
        }
        return {
          serviceName: CUSTOM_SERVICE_NAME,
          toolName: tool.name,
        };
      })();

      return {
        name: tool.name,
        serverName: serviceName,
        toolName,
        description: tool.description || "",
        enabled: tool.enabled ?? false,
        inputSchema: tool.inputSchema,
      };
    },
    []
  );

  /**
   * 加载工具列表
   */
  const loadTools = useCallback(async () => {
    setLoading(true);
    try {
      const toolsList = await apiClient.getToolsList("all");
      const formattedTools = toolsList.map((tool) => formatTool(tool));
      setTools(formattedTools);
    } catch (error) {
      console.error("获取工具列表失败:", error);
      setTools([]);
    } finally {
      setLoading(false);
    }
  }, [formatTool]);

  /**
   * 当命令面板打开时加载工具列表
   */
  useEffect(() => {
    if (open) {
      loadTools();
      setSearchValue("");
      setSelectedIndex(0);
      // 聚焦输入框，注意清理 timeout 以避免内存泄漏
      const timerId = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);

      return () => clearTimeout(timerId);
    }
  }, [open, loadTools]);

  /**
   * 过滤工具列表
   */
  const filteredTools = useMemo(() => {
    if (!searchValue.trim()) {
      return tools;
    }

    const searchLower = searchValue.toLowerCase();
    return tools.filter(
      (tool) =>
        tool.serverName.toLowerCase().includes(searchLower) ||
        tool.toolName.toLowerCase().includes(searchLower) ||
        tool.description.toLowerCase().includes(searchLower)
    );
  }, [tools, searchValue]);

  /**
   * 当过滤后的工具列表长度变化时，确保 selectedIndex 仍然在有效范围内
   */
  useEffect(() => {
    if (selectedIndex >= filteredTools.length && filteredTools.length > 0) {
      setSelectedIndex(0);
    }
  }, [filteredTools.length, selectedIndex]);

  /**
   * 处理工具选择
   */
  const handleToolSelect = useCallback(
    (tool: FormattedTool) => {
      onToolSelect(tool);
      onOpenChange(false);
    },
    [onToolSelect, onOpenChange]
  );

  /**
   * 处理键盘事件
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      // 空列表时不处理键盘导航
      if (filteredTools.length === 0) {
        // ESC 键仍然可用
        if (event.key === "Escape") {
          event.preventDefault();
          onOpenChange(false);
        }
        return;
      }

      // 回车键：选中当前工具
      if (event.key === "Enter") {
        event.preventDefault();
        handleToolSelect(filteredTools[selectedIndex]);
        return;
      }

      // ESC 键：关闭命令面板
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }

      // 上箭头：向上选择
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredTools.length - 1
        );
        return;
      }

      // 下箭头：向下选择
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredTools.length - 1 ? prev + 1 : 0
        );
        return;
      }
    },
    [filteredTools, selectedIndex, handleToolSelect, onOpenChange]
  );

  /**
   * 当选中索引变化时滚动到对应项
   */
  useEffect(() => {
    // 仅在有实际工具项且列表容器存在时才尝试滚动
    if (!listRef.current) return;
    if (!filteredTools || filteredTools.length === 0) return;

    const children = listRef.current.children;
    if (selectedIndex < 0 || selectedIndex >= children.length) {
      return;
    }

    const selectedItem = children[selectedIndex] as HTMLElement | undefined;
    if (selectedItem) {
      selectedItem.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex, filteredTools]);

  /**
   * 获取快捷键文本
   */
  const getShortcutText = useCallback(() => {
    if (typeof window === "undefined") return "⌘K";
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    return isMac ? "⌘K" : "Ctrl+K";
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay className="bg-black/50 backdrop-blur-sm">
        <DialogContent
          className="p-0 max-w-2xl"
          onInteractOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <div className="flex flex-col">
            {/* 搜索输入框 */}
            <div className="flex items-center border-b px-3 py-3">
              <Search className="h-4 w-4 shrink-0 opacity-50 mr-2" />
              <input
                ref={inputRef}
                type="text"
                value={searchValue}
                onChange={(e) => {
                  setSearchValue(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="搜索工具..."
                className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground text-sm"
              />
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                <span className="text-xs">{getShortcutText()}</span>
              </kbd>
            </div>

            {/* 工具列表 */}
            <ScrollArea className="max-h-[400px]">
              <div ref={listRef} className="p-2">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredTools.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-muted-foreground">
                      {searchValue ? "没有找到匹配的工具" : "暂无可用工具"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredTools.map((tool, index) => (
                      <ToolListItem
                        key={tool.name}
                        tool={tool}
                        isSelected={index === selectedIndex}
                        onClick={() => handleToolSelect(tool)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* 底部提示 */}
            <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex h-4 select-none items-center gap-1 rounded border bg-muted px-1 font-mono text-[10px]">
                    ↑↓
                  </kbd>
                  导航
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex h-4 select-none items-center gap-1 rounded border bg-muted px-1 font-mono text-[10px]">
                    ↵
                  </kbd>
                  选择
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex h-4 select-none items-center gap-1 rounded border bg-muted px-1 font-mono text-[10px]">
                    esc
                  </kbd>
                  关闭
                </span>
              </div>
              <span>{filteredTools.length} 个工具</span>
            </div>
          </div>
        </DialogContent>
      </DialogOverlay>
    </Dialog>
  );
}

/**
 * 命令面板钩子
 * 用于管理命令面板的全局状态
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  /**
   * 处理全局快捷键事件
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 检查是否是 Cmd+K (Mac) 或 Ctrl+K (Windows/Linux)
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      const isShortcutKey = isMac
        ? event.metaKey && event.key === "k"
        : event.ctrlKey && event.key === "k";

      if (isShortcutKey) {
        // 检查当前焦点是否在输入框或可编辑元素中
        const activeElement = document.activeElement as HTMLElement | null;
        const tagName = activeElement?.tagName;
        const isInputFocused =
          tagName === "INPUT" ||
          tagName === "TEXTAREA" ||
          activeElement?.hasAttribute("contenteditable");

        // 只有在非输入状态下才触发命令面板
        if (!isInputFocused) {
          event.preventDefault();
          setOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return {
    open,
    setOpen,
  };
}
