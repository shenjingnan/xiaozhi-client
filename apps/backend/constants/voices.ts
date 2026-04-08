/**
 * TTS 音色数据常量
 * 来源于火山引擎豆包语音合成模型 2.0
 */

import type { VoiceInfo } from "@xiaozhi-client/shared-types";

/**
 * TTS 音色列表
 * 仅包含 2.0 版本的音色（推荐，支持情感变化）
 */
export const TTS_VOICES: VoiceInfo[] = [
  // === 通用场景 ===
  {
    name: "Vivi 2.0",
    voiceType: "zh_female_vv_uranus_bigtts",
    scene: "通用场景",
    language: "中文、日文、印尼、墨西哥西班牙语",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "小何 2.0",
    voiceType: "zh_female_xiaohe_uranus_bigtts",
    scene: "通用场景",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "云舟 2.0",
    voiceType: "zh_male_m191_uranus_bigtts",
    scene: "通用场景",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "小天 2.0",
    voiceType: "zh_male_taocheng_uranus_bigtts",
    scene: "通用场景",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "刘飞 2.0",
    voiceType: "zh_male_liufei_uranus_bigtts",
    scene: "通用场景",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "魅力苏菲 2.0",
    voiceType: "zh_male_sophie_uranus_bigtts",
    scene: "通用场景",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "清新女声 2.0",
    voiceType: "zh_female_qingxinnvsheng_uranus_bigtts",
    scene: "通用场景",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "甜美小源 2.0",
    voiceType: "zh_female_tianmeixiaoyuan_uranus_bigtts",
    scene: "通用场景",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "甜美桃子 2.0",
    voiceType: "zh_female_tianmeitaozi_uranus_bigtts",
    scene: "通用场景",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "爽快思思 2.0",
    voiceType: "zh_female_shuangkuaisisi_uranus_bigtts",
    scene: "通用场景",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "邻家女孩 2.0",
    voiceType: "zh_female_linjianvhai_uranus_bigtts",
    scene: "通用场景",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "少年梓辛/Brayan 2.0",
    voiceType: "zh_male_shaonianzixin_uranus_bigtts",
    scene: "通用场景",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "魅力女友 2.0",
    voiceType: "zh_female_meilinvyou_uranus_bigtts",
    scene: "通用场景",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },

  // === 角色扮演 ===
  {
    name: "知性灿灿 2.0",
    voiceType: "zh_female_cancan_uranus_bigtts",
    scene: "角色扮演",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "撒娇学妹 2.0",
    voiceType: "zh_female_sajiaoxuemei_uranus_bigtts",
    scene: "角色扮演",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },

  // === 视频配音 ===
  {
    name: "佩奇猪 2.0",
    voiceType: "zh_female_peiqi_uranus_bigtts",
    scene: "视频配音",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "猴哥 2.0",
    voiceType: "zh_male_sunwukong_uranus_bigtts",
    scene: "视频配音",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "大壹 2.0",
    voiceType: "zh_male_dayi_uranus_bigtts",
    scene: "视频配音",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "黑猫侦探社咪仔 2.0",
    voiceType: "zh_female_mizai_uranus_bigtts",
    scene: "视频配音",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "鸡汤女 2.0",
    voiceType: "zh_female_jitangnv_uranus_bigtts",
    scene: "视频配音",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "流畅女声 2.0",
    voiceType: "zh_female_liuchangnv_uranus_bigtts",
    scene: "视频配音",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "儒雅逸辰 2.0",
    voiceType: "zh_male_ruyayichen_uranus_bigtts",
    scene: "视频配音",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },

  // === 教育场景 ===
  {
    name: "Tina老师 2.0",
    voiceType: "zh_female_yingyujiaoxue_uranus_bigtts",
    scene: "教育场景",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },

  // === 客服场景 ===
  {
    name: "暖阳女声 2.0",
    voiceType: "zh_female_kefunvsheng_uranus_bigtts",
    scene: "客服场景",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "轻盈朵朵 2.0",
    voiceType: "saturn_zh_female_qingyingduoduo_cs_tob",
    scene: "客服场景",
    language: "中文",
    capabilities: ["指令遵循"],
    modelVersion: "2.0",
  },
  {
    name: "温婉珊珊 2.0",
    voiceType: "saturn_zh_female_wenwanshanshan_cs_tob",
    scene: "客服场景",
    language: "中文",
    capabilities: ["指令遵循"],
    modelVersion: "2.0",
  },
  {
    name: "热情艾娜 2.0",
    voiceType: "saturn_zh_female_reqingaina_cs_tob",
    scene: "客服场景",
    language: "中文",
    capabilities: ["指令遵循"],
    modelVersion: "2.0",
  },

  // === 有声阅读 ===
  {
    name: "儿童绘本 2.0",
    voiceType: "zh_female_xiaoxue_uranus_bigtts",
    scene: "有声阅读",
    language: "中文",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },

  // === 多语种 ===
  {
    name: "Tim",
    voiceType: "en_male_tim_uranus_bigtts",
    scene: "多语种",
    language: "美式英语",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "Dacey",
    voiceType: "en_female_dacey_uranus_bigtts",
    scene: "多语种",
    language: "美式英语",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
  {
    name: "Stokie",
    voiceType: "en_female_stokie_uranus_bigtts",
    scene: "多语种",
    language: "美式英语",
    capabilities: ["情感变化", "指令遵循", "ASMR"],
    modelVersion: "2.0",
  },
];

/**
 * 获取所有可用的 TTS 音色场景列表
 * @returns 场景名称数组（如 "通用场景"、"客服"、"导航" 等）
 */
export function getVoiceScenes(): string[] {
  const scenes = new Set<string>();
  for (const voice of TTS_VOICES) {
    scenes.add(voice.scene);
  }
  return Array.from(scenes);
}

/**
 * 按场景分组获取 TTS 音色列表
 * @returns 场景名称到音色列表的映射
 */
export function getVoicesByScene(): Map<string, VoiceInfo[]> {
  const result = new Map<string, VoiceInfo[]>();
  for (const voice of TTS_VOICES) {
    const voices = result.get(voice.scene) || [];
    voices.push(voice);
    result.set(voice.scene, voices);
  }
  return result;
}
