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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useWebSocketActions } from "@/providers/WebSocketProvider";
import { useConfig } from "@/stores/config";
import { zodResolver } from "@hookform/resolvers/zod";
import type { AppConfig, ASRConfig, LLMConfig, TTSConfig } from "@xiaozhi-client/shared-types";
import { SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

/**
 * ASR 配置表单 Schema
 */
const asrSchema = z.object({
  appid: z.string().optional(),
  accessToken: z.string().optional(),
  cluster: z.string().optional(),
  wsUrl: z.string().optional(),
});

/**
 * LLM 配置表单 Schema
 */
const llmSchema = z.object({
  model: z.string().min(1, { message: "模型名称不能为空" }),
  apiKey: z.string().min(1, { message: "API 密钥不能为空" }),
  baseURL: z.string().url({ message: "请输入有效的 URL" }),
  prompt: z.string().optional(),
});

/**
 * TTS 配置表单 Schema
 */
const ttsSchema = z.object({
  appid: z.string().optional(),
  accessToken: z.string().optional(),
  voice_type: z.string().optional(),
  encoding: z.string().optional(),
  cluster: z.string().optional(),
  endpoint: z.string().optional(),
});

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

  // ASR 表单
  const asrForm = useForm<z.infer<typeof asrSchema>>({
    resolver: zodResolver(asrSchema),
    defaultValues: {
      appid: config?.asr?.appid || "",
      accessToken: config?.asr?.accessToken || "",
      cluster: config?.asr?.cluster || "",
      wsUrl: config?.asr?.wsUrl || "",
    },
  });

  // LLM 表单
  const llmForm = useForm<z.infer<typeof llmSchema>>({
    resolver: zodResolver(llmSchema),
    defaultValues: {
      model: config?.llm?.model || "",
      apiKey: config?.llm?.apiKey || "",
      baseURL: config?.llm?.baseURL || "",
      prompt: config?.llm?.prompt || "",
    },
  });

  // TTS 表单
  const ttsForm = useForm<z.infer<typeof ttsSchema>>({
    resolver: zodResolver(ttsSchema),
    defaultValues: {
      appid: config?.tts?.appid || "",
      accessToken: config?.tts?.accessToken || "",
      voice_type: config?.tts?.voice_type || "",
      encoding: config?.tts?.encoding || "",
      cluster: config?.tts?.cluster || "",
      endpoint: config?.tts?.endpoint || "",
    },
  });

  // 当配置加载后，更新表单默认值
  useEffect(() => {
    asrForm.reset({
      appid: config?.asr?.appid || "",
      accessToken: config?.asr?.accessToken || "",
      cluster: config?.asr?.cluster || "",
      wsUrl: config?.asr?.wsUrl || "",
    });
    llmForm.reset({
      model: config?.llm?.model || "",
      apiKey: config?.llm?.apiKey || "",
      baseURL: config?.llm?.baseURL || "",
      prompt: config?.llm?.prompt || "",
    });
    ttsForm.reset({
      appid: config?.tts?.appid || "",
      accessToken: config?.tts?.accessToken || "",
      voice_type: config?.tts?.voice_type || "",
      encoding: config?.tts?.encoding || "",
      cluster: config?.tts?.cluster || "",
      endpoint: config?.tts?.endpoint || "",
    });
  }, [config, asrForm, llmForm, ttsForm]);

  async function onSubmit() {
    if (!config) {
      toast.error("配置数据未加载，请稍后重试");
      return;
    }

    // 验证所有表单
    const asrValid = await asrForm.trigger();
    const llmValid = await llmForm.trigger();
    const ttsValid = await ttsForm.trigger();

    if (!asrValid || !llmValid || !ttsValid) {
      toast.error("请检查表单填写是否正确");
      return;
    }

    setIsLoading(true);
    try {
      const asrValues = asrForm.getValues();
      const llmValues = llmForm.getValues();
      const ttsValues = ttsForm.getValues();

      // 构建新的配置对象，过滤掉空值
      const newASR: ASRConfig | undefined = asrValues.appid || asrValues.accessToken
        ? {
            appid: asrValues.appid || undefined,
            accessToken: asrValues.accessToken || undefined,
            cluster: asrValues.cluster || undefined,
            wsUrl: asrValues.wsUrl || undefined,
          }
        : undefined;

      const newLLM: LLMConfig = {
        model: llmValues.model,
        apiKey: llmValues.apiKey,
        baseURL: llmValues.baseURL,
        prompt: llmValues.prompt || undefined,
      };

      const newTTS: TTSConfig | undefined = ttsValues.appid || ttsValues.accessToken
        ? {
            appid: ttsValues.appid || undefined,
            accessToken: ttsValues.accessToken || undefined,
            voice_type: ttsValues.voice_type || undefined,
            encoding: ttsValues.encoding || undefined,
            cluster: ttsValues.cluster || undefined,
            endpoint: ttsValues.endpoint || undefined,
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
        <Tabs defaultValue="asr" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="asr">ASR 配置</TabsTrigger>
            <TabsTrigger value="llm">LLM 配置</TabsTrigger>
            <TabsTrigger value="tts">TTS 配置</TabsTrigger>
          </TabsList>
          <TabsContent value="asr" className="mt-4">
            <Form {...asrForm}>
              <div className="grid gap-4 max-h-[50vh] overflow-y-auto pr-2">
                <FormField
                  control={asrForm.control}
                  name="appid"
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
                  control={asrForm.control}
                  name="accessToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>访问令牌</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入访问令牌"
                          className="font-mono text-sm"
                          type="password"
                          disabled={isLoading}
                          autoComplete="off"
                          data-1p-ignore
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={asrForm.control}
                  name="cluster"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>集群类型</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="默认：volcengine_streaming_common"
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
                  control={asrForm.control}
                  name="wsUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WebSocket 端点</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="自定义 WebSocket 端点（可选）"
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
            </Form>
          </TabsContent>
          <TabsContent value="llm" className="mt-4">
            <Form {...llmForm}>
              <div className="grid gap-4 max-h-[50vh] overflow-y-auto pr-2">
                <FormField
                  control={llmForm.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>模型名称 <span className="text-red-500">*</span></FormLabel>
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
                  control={llmForm.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API 密钥 <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入 API 密钥"
                          className="font-mono text-sm"
                          type="password"
                          disabled={isLoading}
                          autoComplete="off"
                          data-1p-ignore
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={llmForm.control}
                  name="baseURL"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API 基础地址 <span className="text-red-500">*</span></FormLabel>
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
                  control={llmForm.control}
                  name="prompt"
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
            </Form>
          </TabsContent>
          <TabsContent value="tts" className="mt-4">
            <Form {...ttsForm}>
              <div className="grid gap-4 max-h-[50vh] overflow-y-auto pr-2">
                <FormField
                  control={ttsForm.control}
                  name="appid"
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
                  control={ttsForm.control}
                  name="accessToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>访问令牌</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入访问令牌"
                          className="font-mono text-sm"
                          type="password"
                          disabled={isLoading}
                          autoComplete="off"
                          data-1p-ignore
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={ttsForm.control}
                  name="voice_type"
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
                <FormField
                  control={ttsForm.control}
                  name="cluster"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>集群类型</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="如：volcano_tts"
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
                  control={ttsForm.control}
                  name="encoding"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>编码格式</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="默认：wav"
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
                  control={ttsForm.control}
                  name="endpoint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WebSocket 端点</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="自定义 WebSocket 端点（可选）"
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
            </Form>
          </TabsContent>
        </Tabs>
        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="outline" disabled={isLoading}>
              取消
            </Button>
          </DialogClose>
          <Button type="button" disabled={isLoading} onClick={onSubmit}>
            {isLoading ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}