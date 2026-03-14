/**
 * 语音交互设置对话框组件
 *
 * 在对话框中展示和编辑 ASR/LLM/TTS 配置。
 */

import { PromptEditorDialog } from "@/components/prompt-editor-dialog";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useWebSocketActions } from "@/providers/WebSocketProvider";
import { type PromptFileInfo, apiClient } from "@/services/api";
import { useConfig } from "@/stores/config";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
  ASRConfig,
  AppConfig,
  LLMConfig,
  TTSConfig,
  VoiceInfo,
} from "@xiaozhi-client/shared-types";
import { Edit, Plus, SettingsIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [promptFiles, setPromptFiles] = useState<PromptFileInfo[]>([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [selectedPromptPath, setSelectedPromptPath] = useState<
    string | undefined
  >(undefined);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
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

  // 使用 ref 追踪本次打开是否已初始化表单
  const initializedRef = useRef(false);

  // 当弹窗打开且 config 就绪时，初始化表单数据
  // 只在本次打开期间初始化一次，关闭时重置标记
  // 如果表单已被用户修改（isDirty），则跳过初始化，避免覆盖用户输入
  useEffect(() => {
    if (open && !initializedRef.current && config && !form.formState.isDirty) {
      form.reset({
        asr: {
          appid: config.asr?.appid || "",
          accessToken: config.asr?.accessToken || "",
        },
        llm: {
          model: config.llm?.model || "",
          apiKey: config.llm?.apiKey || "",
          baseURL: config.llm?.baseURL || "",
          prompt: config.llm?.prompt || "",
        },
        tts: {
          appid: config.tts?.appid || "",
          accessToken: config.tts?.accessToken || "",
          voice_type: config.tts?.voice_type || "",
        },
      });
      initializedRef.current = true;
    }
    // 弹窗关闭时重置初始化标记
    if (!open) {
      initializedRef.current = false;
    }
  }, [open, config, form, form.formState.isDirty]);

  // 加载提示词文件列表
  const loadPromptFiles = useCallback(async () => {
    setIsLoadingPrompts(true);
    try {
      const files = await apiClient.getPromptFiles();
      setPromptFiles(files);
    } catch (error) {
      console.error("加载提示词文件列表失败:", error);
      setPromptFiles([]);
    } finally {
      setIsLoadingPrompts(false);
    }
  }, []);

  // 加载音色列表
  const loadVoices = useCallback(async () => {
    setIsLoadingVoices(true);
    try {
      const response = await apiClient.getTTSVoices();
      setVoices(response.voices);
    } catch (error) {
      console.error("加载音色列表失败:", error);
      setVoices([]);
    } finally {
      setIsLoadingVoices(false);
    }
  }, []);

  // 对话框打开时加载提示词文件列表
  useEffect(() => {
    if (open) {
      loadPromptFiles();
      loadVoices();
    }
  }, [open, loadPromptFiles, loadVoices]);

  // 打开提示词编辑器（编辑模式）
  const handleEditPrompt = useCallback(() => {
    const currentPath = form.getValues("llm.prompt");
    if (currentPath && currentPath !== "__none__") {
      setSelectedPromptPath(currentPath);
    } else {
      setSelectedPromptPath(undefined);
    }
    setPromptEditorOpen(true);
  }, [form]);

  // 打开提示词编辑器（新建模式）
  const handleCreatePrompt = useCallback(() => {
    setSelectedPromptPath(undefined);
    setPromptEditorOpen(true);
  }, []);

  // 提示词更新后的处理
  const handlePromptUpdated = useCallback(() => {
    loadPromptFiles();
  }, [loadPromptFiles]);

  // 提示词创建后的处理
  const handlePromptCreated = useCallback(
    (relativePath: string) => {
      loadPromptFiles();
      // 自动选择新创建的提示词文件
      form.setValue("llm.prompt", relativePath);
    },
    [loadPromptFiles, form]
  );

  // 提示词删除后的处理
  const handlePromptDeleted = useCallback(() => {
    loadPromptFiles();
    // 清空当前选择
    form.setValue("llm.prompt", "");
  }, [loadPromptFiles, form]);

  async function onSubmit(values: VoiceInteractionFormValues) {
    if (!config) {
      toast.error("配置数据未加载，请稍后重试");
      return;
    }

    setIsLoading(true);
    try {
      // 构建新的配置对象
      // 当表单字段全为空时，使用空对象 {} 显式告知服务端要清空配置
      // 而不是使用 undefined（因为 undefined 在 JSON 序列化时会被丢弃）
      const newASR: ASRConfig | undefined =
        values.asr.appid || values.asr.accessToken
          ? {
              appid: values.asr.appid || undefined,
              accessToken: values.asr.accessToken || undefined,
            }
          : {};

      const newLLM: LLMConfig = {
        model: values.llm.model,
        apiKey: values.llm.apiKey,
        baseURL: values.llm.baseURL,
        prompt: values.llm.prompt || undefined,
      };

      const newTTS: TTSConfig | undefined =
        values.tts.appid || values.tts.accessToken || values.tts.voice_type
          ? {
              appid: values.tts.appid || undefined,
              accessToken: values.tts.accessToken || undefined,
              voice_type: values.tts.voice_type || undefined,
            }
          : {};

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
    <>
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
                          <FormLabel>系统提示词文件</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Select
                                disabled={isLoading || isLoadingPrompts}
                                value={field.value || "__none__"}
                                onValueChange={(value) => {
                                  // 将特殊值转换为空字符串
                                  field.onChange(
                                    value === "__none__" ? "" : value
                                  );
                                }}
                              >
                                <SelectTrigger className="font-mono text-sm flex-1">
                                  <SelectValue placeholder="选择提示词文件（可选）" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">
                                    不使用提示词文件
                                  </SelectItem>
                                  {promptFiles.map((file) => (
                                    <SelectItem
                                      key={file.relativePath}
                                      value={file.relativePath}
                                    >
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
                              onClick={handleEditPrompt}
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
                              onClick={handleCreatePrompt}
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
                            <Select
                              disabled={isLoading || isLoadingVoices}
                              value={field.value || "__none__"}
                              onValueChange={(value) => {
                                field.onChange(
                                  value === "__none__" ? "" : value
                                );
                              }}
                            >
                              <SelectTrigger className="font-mono text-sm">
                                <SelectValue placeholder="选择音色（可选）" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">
                                  不指定音色
                                </SelectItem>
                                {field.value &&
                                  field.value !== "__none__" &&
                                  !voices.some(
                                    (v) => v.voiceType === field.value
                                  ) && (
                                    <SelectItem value={field.value}>
                                      {field.value} (自定义音色)
                                    </SelectItem>
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
                                      <SelectItem
                                        key={voice.voiceType}
                                        value={voice.voiceType}
                                      >
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

      {/* 提示词编辑器对话框 */}
      <PromptEditorDialog
        open={promptEditorOpen}
        onOpenChange={setPromptEditorOpen}
        selectedPath={selectedPromptPath}
        onPromptUpdated={handlePromptUpdated}
        onPromptCreated={handlePromptCreated}
        onPromptDeleted={handlePromptDeleted}
      />
    </>
  );
}
