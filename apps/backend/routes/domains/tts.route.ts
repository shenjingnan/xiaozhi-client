/**
 * TTS API 路由配置
 * 处理所有 TTS 相关的 API 路由
 */

import type { RouteDefinition } from "@/routes/types.js";
import { createHandler } from "@/routes/types.js";

const h = createHandler("ttsApiHandler");

export const ttsRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/api/tts",
    handler: h((handler, c) => handler.synthesize(c)),
  },
];
