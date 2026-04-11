/**
 * TTS 配置区块组件
 *
 * 在语音交互设置对话框中展示 TTS（语音合成）配置表单字段
 */

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VoiceInfo } from "@xiaozhi-client/shared-types";
import type { UseFormReturn } from "react-hook-form";
import type { VoiceInteractionFormValues } from "./voice-interaction-setting-dialog";

/**
 * TTS 配置区块组件属性
 */
export interface TTSConfigSectionProps {
  /** 表单实例 */
  form: UseFormReturn<VoiceInteractionFormValues>;
  /** 是否正在加载/保存 */
  isLoading: boolean;
  /** 是否正在加载音色列表 */
  isLoadingVoices: boolean;
  /** 音色列表 */
  voices: VoiceInfo[];
}

/**
 * TTS 配置区块组件
 */
export function TTSConfigSection({ form, isLoading, isLoadingVoices, voices }: TTSConfigSectionProps) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium text-foreground mb-3">TTS 配置</h3>
      <div className="grid gap-4">
        <FormField
          control={form.control}
          name="tts.appid"
          render={({ field }) => (
            <FormItem>
              <FormLabel>应用 ID</FormLabel>
              <FormControl>
                <Input
                  placeholder="请输入火山引擎语音合成应用 ID"
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
          name="tts.accessToken"
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
        <FormField
          control={form.control}
          name="tts.voice_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>声音类型</FormLabel>
              <FormControl>
                <Select
                  disabled={isLoading || isLoadingVoices}
                  value={field.value || "__none__"}
                  onValueChange={(value) => {
                    field.onChange(value === "__none__" ? "" : value);
                  }}
                >
                  <SelectTrigger className="font-mono text-sm">
                    <SelectValue placeholder="选择音色（可选）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">不指定音色</SelectItem>
                    {field.value &&
                      field.value !== "__none__" &&
                      !voices.some((v) => v.voiceType === field.value) && (
                        <SelectItem value={field.value}>{field.value} (自定义音色)</SelectItem>
                      )}
                    {Object.entries(
                      voices.reduce(
                        (acc, voice) => {
                          if (!acc[voice.scene]) {
                            acc[voice.scene] = [];
                          }
                          acc[voice.scene].push(voice);
                          return acc;
                        },
                        {} as Record<string, VoiceInfo[]>
                      )
                    ).map(([scene, sceneVoices]) => (
                      <SelectGroup key={scene}>
                        <SelectLabel>{scene}</SelectLabel>
                        {sceneVoices.map((voice) => (
                          <SelectItem key={voice.voiceType} value={voice.voiceType}>
                            {voice.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}