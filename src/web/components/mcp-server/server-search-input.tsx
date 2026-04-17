/**
 * MCP 服务器搜索输入组件
 * 重新导出 ToolSearchInput 组件用于服务器表格
 */

export { ToolSearchInput as ServerSearchInput } from "@/components/mcp-tool/tool-search-input";

/** 服务器搜索输入组件属性 */
export interface ServerSearchInputProps {
  /** 搜索框的值 */
  value: string;
  /** 值变化回调 */
  onChange: (value: string) => void;
  /** 占位符文本 */
  placeholder?: string;
  /** 额外的类名 */
  className?: string;
}
