/**
 * 语音交互设置数据加载 Hook
 *
 * 负责加载提示词文件列表和音色列表数据
 */

import { type PromptFileInfo, apiClient } from "@/services/api";
import type { VoiceInfo } from "@xiaozhi-client/shared-types";
import { useCallback, useEffect, useState } from "react";

/**
 * Hook 返回值类型
 */
export interface UseVoiceInteractionDataReturn {
  /** 提示词文件列表 */
  promptFiles: PromptFileInfo[];
  /** 音色列表 */
  voices: VoiceInfo[];
  /** 是否正在加载提示词 */
  isLoadingPrompts: boolean;
  /** 是否正在加载音色 */
  isLoadingVoices: boolean;
  /** 刷新提示词文件列表 */
  refreshPromptFiles: () => Promise<void>;
}

/**
 * 语音交互数据 Hook
 * @param open 对话框是否打开
 */
export function useVoiceInteractionData(open: boolean): UseVoiceInteractionDataReturn {
  const [promptFiles, setPromptFiles] = useState<PromptFileInfo[]>([]);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);

  /**
   * 加载提示词文件列表
   */
  const loadPromptFiles = useCallback(async () => {
    setIsLoadingPrompts(true);
    try {
      const files = await apiClient.getPromptFiles();
      setPromptFiles(files);
    } catch (error) {
      console.error("[VoiceInteractionData] 加载提示词文件列表失败:", error);
      setPromptFiles([]);
    } finally {
      setIsLoadingPrompts(false);
    }
  }, []);

  /**
   * 加载音色列表
   */
  const loadVoices = useCallback(async () => {
    setIsLoadingVoices(true);
    try {
      const response = await apiClient.getTTSVoices();
      setVoices(response.voices);
    } catch (error) {
      console.error("[VoiceInteractionData] 加载音色列表失败:", error);
      setVoices([]);
    } finally {
      setIsLoadingVoices(false);
    }
  }, []);

  /**
   * 刷新提示词文件列表（用于创建/更新/删除提示词后）
   */
  const refreshPromptFiles = useCallback(async () => {
    await loadPromptFiles();
  }, [loadPromptFiles]);

  // 对话框打开时自动加载数据
  useEffect(() => {
    if (open) {
      loadPromptFiles();
      loadVoices();
    }
  }, [open, loadPromptFiles, loadVoices]);

  return {
    promptFiles,
    voices,
    isLoadingPrompts,
    isLoadingVoices,
    refreshPromptFiles,
  };
}