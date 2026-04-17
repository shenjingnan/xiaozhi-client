/**
 * 实时语音卡片组件
 *
 * 展示 ASR/LLM/TTS 配置状态，提供语音交互设置入口。
 */

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VoiceInteractionSettingDialog } from "@/components/voice-interaction-setting-dialog";
import { useVoiceInteractionConfig } from "@/stores/config";
import { useMemo } from "react";
import { MiniCircularProgress } from "./mini-circular-progress";

/**
 * 检查 ASR 是否已配置
 */
function isASRReady(
  asr: { appid?: string; accessToken?: string } | undefined
): boolean {
  return Boolean(asr?.appid && asr?.accessToken);
}

/**
 * 检查 LLM 是否已配置
 */
function isLLMReady(
  llm: { model?: string; apiKey?: string; baseURL?: string } | undefined
): boolean {
  return Boolean(llm?.model && llm?.apiKey && llm?.baseURL);
}

/**
 * 检查 TTS 是否已配置
 */
function isTTSReady(
  tts: { appid?: string; accessToken?: string; voice_type?: string } | undefined
): boolean {
  return Boolean(tts?.appid && tts?.accessToken && tts?.voice_type);
}

/**
 * 实时语音卡片组件
 *
 * 显示 ASR/LLM/TTS 配置完成度，右上角显示配置完成度进度指示器。
 * 底部提供快速打开语音交互设置对话框的按钮。
 */
export function VoiceInteractionCard() {
  const { asr, llm, tts } = useVoiceInteractionConfig();

  // 计算已配置项数量
  const configuredCount = useMemo(() => {
    let count = 0;
    if (isASRReady(asr)) count++;
    if (isLLMReady(llm)) count++;
    if (isTTSReady(tts)) count++;
    return count;
  }, [asr, llm, tts]);

  const totalItems = 3;
  const completionRate = configuredCount / totalItems;

  // 生成状态描述
  const statusParts: string[] = [];
  if (isASRReady(asr)) statusParts.push("ASR");
  if (isLLMReady(llm)) statusParts.push("LLM");
  if (isTTSReady(tts)) statusParts.push("TTS");

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardDescription>实时语音</CardDescription>
        <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
          {configuredCount}/{totalItems} 就绪
        </CardTitle>
        <div className="absolute right-4 top-4">
          <MiniCircularProgress
            showValue={true}
            value={configuredCount}
            maxValue={totalItems}
            activeColor={
              completionRate >= 1
                ? "#16a34a"
                : completionRate >= 0.66
                  ? "#f59e0b"
                  : "#f87171"
            }
            inactiveColor="#e5e7eb"
            size={30}
            symbol=""
          />
        </div>
      </CardHeader>
      <CardFooter className="flex items-center justify-between gap-1 text-sm">
        <div className="text-muted-foreground">
          {completionRate === 1
            ? "语音交互已就绪"
            : statusParts.length > 0
              ? `${statusParts.join("、")} 已配置`
              : "请配置语音服务"}
        </div>
        <VoiceInteractionSettingDialog />
      </CardFooter>
    </Card>
  );
}
