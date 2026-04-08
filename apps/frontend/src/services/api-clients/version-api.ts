/**
 * 版本信息 API 客户端
 * 负责所有版本信息和更新相关的操作
 */

import type { VoicesResponse } from "@xiaozhi-client/shared-types";
import { type ApiResponse, HttpClient } from "./http-client";

/**
 * 版本信息接口
 */
export interface VersionInfo {
  name: string;
  version: string;
  description: string;
  author: string;
}

/**
 * 版本信息 API 客户端
 */
export class VersionApiClient extends HttpClient {
  /**
   * 获取 TTS 音色列表
   */
  async getTTSVoices(): Promise<VoicesResponse> {
    const response: ApiResponse<VoicesResponse> =
      await this.request("/api/tts/voices");
    if (!response.success || !response.data) {
      throw new Error("获取音色列表失败");
    }
    return response.data;
  }

  /**
   * 获取版本信息
   */
  async getVersion(): Promise<VersionInfo> {
    const response: ApiResponse<VersionInfo> =
      await this.request("/api/version");
    if (!response.success || !response.data) {
      throw new Error("获取版本信息失败");
    }
    return response.data;
  }

  /**
   * 获取版本号（简化接口）
   */
  async getVersionSimple(): Promise<{ version: string }> {
    const response: ApiResponse<{ version: string }> = await this.request(
      "/api/version/simple"
    );
    if (!response.success || !response.data) {
      throw new Error("获取版本号失败");
    }
    return response.data;
  }

  /**
   * 获取可用版本列表
   * @param type 版本类型：'stable'（正式版）、'rc'（预览版）、'beta'（测试版）、'all'（全部）
   */
  async getAvailableVersions(
    type: "stable" | "rc" | "beta" | "all" = "stable"
  ): Promise<{
    versions: string[];
    type: string;
    total: number;
  }> {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (type !== "stable") {
      queryParams.append("type", type);
    }

    const url = `/api/version/available${
      queryParams.toString() ? `?${queryParams.toString()}` : ""
    }`;

    const response: ApiResponse<{
      versions: string[];
      type: string;
      total: number;
    }> = await this.request(url);
    if (!response.success || !response.data) {
      throw new Error("获取可用版本列表失败");
    }
    return response.data;
  }

  /**
   * 检查最新版本
   * 返回当前版本、最新版本以及是否有更新
   */
  async getLatestVersion(): Promise<{
    currentVersion: string;
    latestVersion: string | null;
    hasUpdate: boolean;
    error?: string;
  }> {
    const response: ApiResponse<{
      currentVersion: string;
      latestVersion: string | null;
      hasUpdate: boolean;
      error?: string;
    }> = await this.request("/api/version/latest");

    if (!response.success || !response.data) {
      throw new Error("检查最新版本失败");
    }

    return response.data;
  }

  /**
   * 清除版本缓存
   */
  async clearVersionCache(): Promise<void> {
    const response: ApiResponse = await this.request(
      "/api/version/cache/clear",
      {
        method: "POST",
      }
    );
    if (!response.success) {
      throw new Error(response.error?.message || "清除版本缓存失败");
    }
  }

  /**
   * 更新版本
   */
  async updateVersion(version: string): Promise<any> {
    const response: ApiResponse = await this.request("/api/update", {
      method: "POST",
      body: JSON.stringify({ version }),
    });

    if (!response.success) {
      throw new Error(response.error?.message || "版本更新失败");
    }

    return response.data;
  }
}
