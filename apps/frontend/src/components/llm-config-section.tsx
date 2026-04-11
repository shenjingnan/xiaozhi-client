/**
 * LLM 配置区块组件
 *
 * 在语音交互设置对话框中展示 LLM（大语言模型）配置表单字段
 * 包含提示词文件管理功能
 */

import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PromptFileInfo } from "@/services/api";
import type { UseFormReturn } from "react-hook-form";
import { Edit, Plus } from "lucide-react";
import type { VoiceInteractionFormValues } from "./voice-interaction-setting-dialog";

/**
 * LLM 配置区块组件属性
 */
export interface LLMConfigSectionProps {
  /** 表单实例 */
  form: UseFormReturn<VoiceInteractionFormValues>;
  /** 是否正在加载/保存 */
  isLoading: boolean;
  /** 是否正在加载提示词文件 */
  isLoadingPrompts: boolean;
  /** 提示词文件列表 */
  promptFiles: PromptFileInfo[];
  /** 编辑提示词回调 */
  onEditPrompt: () => void;
  /** 创建提示词回调 */
  onCreatePrompt: () => void;
}

/**
 * LLM 配置区块组件
 */
export function LLMConfigSection({
  form,
  isLoading,
  isLoadingPrompts,
  promptFiles,
  onEditPrompt,
  onCreatePrompt,
}: LLMConfigSectionProps) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium text-foreground mb-3">LLM 配置</h3>
      <div className="grid gap-4">
        <FormField
          control={form.control}
          name="llm.model"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                模型名称 <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="如：gpt-4、deepseek-chat"
                  className="font-mono text-sm"
                  disabled={isLoading}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="llm.apiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                API 密钥 <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder="请输入 API 密钥"
                  className="font-mono text-sm"
                  disabled={isLoading}
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="llm.baseURL"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                API 基础地址 <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="如：https://api.openai.com/v1"
                  className="font-mono text-sm"
                  disabled={isLoading}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="llm.prompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>系统提示词文件</FormLabel>
              <div className="flex gap-2">
                <FormControl>
                  <Select
                    disabled={isLoading || isLoadingPrompts}
                    value={field.value || "__none__"}
                    onValueChange={(value) => {
                      // 将特殊值转换为空字符串
                      field.onChange(value === "__none__" ? "" : value);
                    }}
                  >
                    <SelectTrigger className="font-mono text-sm flex-1">
                      <SelectValue placeholder="选择提示词文件（可选）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">不使用提示词文件</SelectItem>
                      {promptFiles.map((file) => (
                        <SelectItem key={file.relativePath} value={file.relativePath}>
                          {file.fileName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={onEditPrompt}
                  disabled={
                    isLoading ||
                    isLoadingPrompts ||
                    !form.watch("llm.prompt") ||
                    form.watch("llm.prompt") === "__none__"
                  }
                  title="编辑选中的提示词文件"
                >
                  <Edit className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={onCreatePrompt}
                  disabled={isLoading || isLoadingPrompts}
                  title="新建提示词文件"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}