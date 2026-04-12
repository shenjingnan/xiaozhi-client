/**
 * ASR 配置区块组件
 *
 * 在语音交互设置对话框中展示 ASR（语音识别）配置表单字段
 */

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import type { UseFormReturn } from "react-hook-form";
import type { VoiceInteractionFormValues } from "./voice-interaction-setting-dialog";

/**
 * ASR 配置区块组件属性
 */
export interface ASRConfigSectionProps {
  /** 表单实例 */
  form: UseFormReturn<VoiceInteractionFormValues>;
  /** 是否正在加载/保存 */
  isLoading: boolean;
}

/**
 * ASR 配置区块组件
 */
export function ASRConfigSection({ form, isLoading }: ASRConfigSectionProps) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium text-foreground mb-3">ASR 配置</h3>
      <div className="grid gap-4">
        <FormField
          control={form.control}
          name="asr.appid"
          render={({ field }) => (
            <FormItem>
              <FormLabel>应用 ID</FormLabel>
              <FormControl>
                <Input
                  placeholder="请输入火山引擎语音识别应用 ID"
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
          name="asr.accessToken"
          render={({ field }) => (
            <FormItem>
              <FormLabel>访问令牌</FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder="请输入访问令牌"
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
      </div>
    </div>
  );
}