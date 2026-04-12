/**
 * 语音交互设置对话框组件
 *
 * 在对话框中展示和编辑 ASR/LLM/TTS 配置。
 */

import { ASRConfigSection } from "@/components/asr-config-section";
import { LLMConfigSection } from "@/components/llm-config-section";
import { PromptEditorDialog } from "@/components/prompt-editor-dialog";
import { TTSConfigSection } from "@/components/tts-config-section";
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
import { Form } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useVoiceInteractionData } from "@/hooks/use-voice-interaction-data";
import { useWebSocketActions } from "@/providers/WebSocketProvider";
import { useConfig } from "@/stores/config";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ASRConfig, AppConfig, LLMConfig, TTSConfig } from "@xiaozhi-client/shared-types";
import { SettingsIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
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

export type VoiceInteractionFormValues = z.infer<typeof voiceInteractionSchema>;

/**
 * 语音交互设置对话框组件
 *
 * 提供在对话框中编辑 ASR/LLM/TTS 配置的功能。
 */
export function VoiceInteractionSettingDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [selectedPromptPath, setSelectedPromptPath] = useState<string | undefined>(undefined);
  const config = useConfig();
  const { updateConfig } = useWebSocketActions();

  // 使用数据加载 Hook
  const { promptFiles, voices, isLoadingPrompts, isLoadingVoices, refreshPromptFiles } =
    useVoiceInteractionData(open);

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
  // 只在本次打开期间初始化一次，关闭时重置标记和表单状态
  const configRef = useRef(config);
  configRef.current = config;

  const resetFormState = useCallback(() => {
    if (configRef.current) {
      form.reset({
        asr: {
          appid: configRef.current.asr?.appid || "",
          accessToken: configRef.current.asr?.accessToken || "",
        },
        llm: {
          model: configRef.current.llm?.model || "",
          apiKey: configRef.current.llm?.apiKey || "",
          baseURL: configRef.current.llm?.baseURL || "",
          prompt: configRef.current.llm?.prompt || "",
        },
        tts: {
          appid: configRef.current.tts?.appid || "",
          accessToken: configRef.current.tts?.accessToken || "",
          voice_type: configRef.current.tts?.voice_type || "",
        },
      });
    }
  }, [form]);

  // 当对话框打开状态变化时处理表单初始化
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      setOpen(newOpen);
      if (newOpen && !initializedRef.current) {
        resetFormState();
        initializedRef.current = true;
      }
      if (!newOpen) {
        initializedRef.current = false;
        form.reset();
      }
    },
    [form, resetFormState]
  );

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
    refreshPromptFiles();
  }, [refreshPromptFiles]);

  // 提示词创建后的处理
  const handlePromptCreated = useCallback(
    (relativePath: string) => {
      refreshPromptFiles();
      // 自动选择新创建的提示词文件
      form.setValue("llm.prompt", relativePath);
    },
    [refreshPromptFiles, form]
  );

  // 提示词删除后的处理
  const handlePromptDeleted = useCallback(() => {
    refreshPromptFiles();
    // 清空当前选择
    form.setValue("llm.prompt", "");
  }, [refreshPromptFiles, form]);

  // 表单提交处理
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
      console.error("[VoiceInteractionDialog] 更新语音交互配置失败:", error);
      toast.error(error instanceof Error ? error.message : "更新配置失败");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
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
                <ASRConfigSection form={form} isLoading={isLoading} />

                <Separator className="my-4" />

                {/* LLM 配置区块 */}
                <LLMConfigSection
                  form={form}
                  isLoading={isLoading}
                  isLoadingPrompts={isLoadingPrompts}
                  promptFiles={promptFiles}
                  onEditPrompt={handleEditPrompt}
                  onCreatePrompt={handleCreatePrompt}
                />

                <Separator className="my-4" />

                {/* TTS 配置区块 */}
                <TTSConfigSection
                  form={form}
                  isLoading={isLoading}
                  isLoadingVoices={isLoadingVoices}
                  voices={voices}
                />
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