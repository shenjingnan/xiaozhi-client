/**
 * 工具调试对话框相关类型定义
 *
 * @description 定义工具调试对话框及其子组件所需的 TypeScript 类型
 */

import type React from "react";

/**
 * 渲染表单字段的函数类型
 */
export type RenderFormFieldFn = (
  fieldName: string,
  fieldSchema: any
) => React.ReactElement | null;

/**
 * 获取类型徽章颜色的函数类型
 */
export type GetTypeBadgeFn = (type: string) => string;

/**
 * 工具信息类型
 */
export interface ToolInfo {
  name: string;
  serverName: string;
  toolName: string;
  description?: string;
  inputSchema?: any;
}

/**
 * 工具调试对话框属性类型
 */
export interface ToolDebugDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: ToolInfo | null;
}

/**
 * 数组字段组件属性类型
 */
export interface ArrayFieldProps {
  name: string;
  schema: any;
  form: any;
  renderFormField: RenderFormFieldFn;
}

/**
 * 对象字段组件属性类型
 */
export interface ObjectFieldProps {
  name: string;
  schema: any;
  form: any;
  renderFormField: RenderFormFieldFn;
  getTypeBadge: GetTypeBadgeFn;
}

/**
 * 表单渲染器组件属性类型
 */
export interface FormRendererProps {
  tool: ToolInfo | null;
  form: any;
  renderFormField: RenderFormFieldFn;
}