/**
 * 火山引擎配置表单字段组件
 *
 * 提供可复用的应用 ID 和访问令牌表单字段，用于 ASR 和 TTS 配置。
 */

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

/**
 * 火山引擎配置字段组件属性
 */
interface VolcengineConfigFieldsProps<
  TFieldValues extends FieldValues = FieldValues,
> {
  /** 表单控制器 */
  control: Control<TFieldValues>;
  /** 字段名前缀（"asr" 或 "tts"） */
  prefix: "asr" | "tts";
  /** 服务类型标签（用于 placeholder） */
  serviceLabel: "语音识别" | "语音合成";
  /** 是否禁用输入 */
  disabled?: boolean;
}

/**
 * 火山引擎配置表单字段组件
 *
 * 提供应用 ID 和访问令牌两个表单字段，消除了 ASR 和 TTS 配置中的代码重复。
 */
export function VolcengineConfigFields<
  TFieldValues extends FieldValues = FieldValues,
>({
  control,
  prefix,
  serviceLabel,
  disabled = false,
}: VolcengineConfigFieldsProps<TFieldValues>) {
  return (
    <>
      <FormField
        control={control}
        name={`${prefix}.appid` as FieldPath<TFieldValues>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>应用 ID</FormLabel>
            <FormControl>
              <Input
                placeholder={`请输入火山引擎${serviceLabel}应用 ID`}
                className="font-mono text-sm"
                disabled={disabled}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`${prefix}.accessToken` as FieldPath<TFieldValues>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>访问令牌</FormLabel>
            <FormControl>
              <PasswordInput
                placeholder="请输入访问令牌"
                className="font-mono text-sm"
                disabled={disabled}
                autoComplete="off"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
