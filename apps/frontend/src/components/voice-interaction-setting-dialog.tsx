/**
 * 语音交互设置对话框组件
 *
 * 在对话框中展示和编辑 ASR/LLM/TTS 配置。
 */

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useWebSocketActions } from "@/providers/WebSocketProvider";
import { useConfig } from "@/stores/config";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
  ASRConfig,
  AppConfig,
  LLMConfig,
  TTSConfig,
} from "@xiaozhi-client/shared-types";
import { SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

/**
 * 语音交互配置表单 Schema
 */
const voiceInteractionSchema = z.object({
  asr: z.object({
    appid: z.string().optional(),
    accessToken: z.string().optional(),
  }),
  llm: z.object({
    model: z.string().min(1, { message: "模型名称不能为空" }),
    apiKey: z.string().min(1, { message: "API 密钥不能为空" }),
    baseURL: z.string().url({ message: "请输入有效的 URL" }),
    prompt: z.string().optional(),
  }),
  tts: z.object({
    appid: z.string().optional(),
    accessToken: z.string().optional(),
    voice_type: z.string().optional(),
  }),
});

type VoiceInteractionFormValues = z.infer<typeof voiceInteractionSchema>;

/**
 * 语音交互设置对话框组件
 *
 * 提供在对话框中编辑 ASR/LLM/TTS 配置的功能。
 */
export function VoiceInteractionSettingDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const config = useConfig();
  const { updateConfig } = useWebSocketActions();

  const form = useForm<VoiceInteractionFormValues>({
    resolver: zodResolver(voiceInteractionSchema),
    defaultValues: {
      asr: {
        appid: config?.asr?.appid || "",
        accessToken: config?.asr?.accessToken || "",
      },
      llm: {
        model: config?.llm?.model || "",
        apiKey: config?.llm?.apiKey || "",
        baseURL: config?.llm?.baseURL || "",
        prompt: config?.llm?.prompt || "",
      },
      tts: {
        appid: config?.tts?.appid || "",
        accessToken: config?.tts?.accessToken || "",
        voice_type: config?.tts?.voice_type || "",
      },
    },
  });

  // 当配置加载后，更新表单默认值
  useEffect(() => {
    form.reset({
      asr: {
        appid: config?.asr?.appid || "",
        accessToken: config?.asr?.accessToken || "",
      },
      llm: {
        model: config?.llm?.model || "",
        apiKey: config?.llm?.apiKey || "",
        baseURL: config?.llm?.baseURL || "",
        prompt: config?.llm?.prompt || "",
      },
      tts: {
        appid: config?.tts?.appid || "",
        accessToken: config?.tts?.accessToken || "",
        voice_type: config?.tts?.voice_type || "",
      },
    });
  }, [config, form]);

  async function onSubmit(values: VoiceInteractionFormValues) {
    if (!config) {
      toast.error("配置数据未加载，请稍后重试");
      return;
    }

    setIsLoading(true);
    try {
      // 构建新的配置对象，过滤掉空值
      const newASR: ASRConfig | undefined =
        values.asr.appid || values.asr.accessToken
          ? {
              appid: values.asr.appid || undefined,
              accessToken: values.asr.accessToken || undefined,
            }
          : undefined;

      const newLLM: LLMConfig = {
        model: values.llm.model,
        apiKey: values.llm.apiKey,
        baseURL: values.llm.baseURL,
        prompt: values.llm.prompt || undefined,
      };

      const newTTS: TTSConfig | undefined =
        values.tts.appid || values.tts.accessToken
          ? {
              appid: values.tts.appid || undefined,
              accessToken: values.tts.accessToken || undefined,
              voice_type: values.tts.voice_type || undefined,
            }
          : undefined;

      const newConfig: AppConfig = {
        ...config,
        asr: newASR,
        llm: newLLM,
        tts: newTTS,
      };

      await updateConfig(newConfig);
      toast.success("语音交互配置已更新");
      setOpen(false);
    } catch (error) {
      console.error("更新语音交互配置失败:", error);
      toast.error(error instanceof Error ? error.message : "更新配置失败");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="icon" className="size-8">
          <SettingsIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>语音交互设置</DialogTitle>
          <DialogDescription>
            配置 ASR（语音识别）、LLM（大语言模型）、TTS（语音合成）服务
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="max-h-[60vh] overflow-y-auto pr-2">
              {/* ASR 配置区块 */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-foreground mb-3">
                  ASR 配置
                </h3>
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

              <Separator className="my-4" />

              {/* LLM 配置区块 */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-foreground mb-3">
                  LLM 配置
                </h3>
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
                        <FormLabel>系统提示词</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="自定义系统提示词（可选）"
                            className="font-mono text-sm min-h-[100px]"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator className="my-4" />

              {/* TTS 配置区块 */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-foreground mb-3">
                  TTS 配置
                </h3>
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
                          <Input
                            placeholder="如：zh_female_shuangkuaisisi_moon_bigtts"
                            className="font-mono text-sm"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isLoading}>
                  取消
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "保存中..." : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
