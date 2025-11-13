/**
 * 输入验证工具
 */

import type { ConfigFormat } from "@cli/Types.js";
import { ValidationError } from "../errors/index.js";

/**
 * 验证工具类
 */
export class Validation {
  /**
   * 验证端口号
   */
  static validatePort(port: number): void {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw ValidationError.invalidPort(port);
    }
  }

  /**
   * 验证配置文件格式
   */
  static validateConfigFormat(format: string): ConfigFormat {
    const validFormats: ConfigFormat[] = ["json", "json5", "jsonc"];

    if (!validFormats.includes(format as ConfigFormat)) {
      throw new ValidationError(
        `无效的配置文件格式: ${format}，支持的格式: ${validFormats.join(", ")}`,
        "format"
      );
    }

    return format as ConfigFormat;
  }

  /**
   * 验证必填字段
   */
  static validateRequired(value: any, fieldName: string): void {
    if (value === undefined || value === null || value === "") {
      throw ValidationError.requiredField(fieldName);
    }
  }

  /**
   * 验证字符串长度
   */
  static validateStringLength(
    value: string,
    fieldName: string,
    options: { min?: number; max?: number } = {}
  ): void {
    if (options.min !== undefined && value.length < options.min) {
      throw new ValidationError(
        `长度不能少于 ${options.min} 个字符，当前长度: ${value.length}`,
        fieldName
      );
    }

    if (options.max !== undefined && value.length > options.max) {
      throw new ValidationError(
        `长度不能超过 ${options.max} 个字符，当前长度: ${value.length}`,
        fieldName
      );
    }
  }

  /**
   * 验证 URL 格式
   */
  static validateUrl(url: string, fieldName = "url"): void {
    try {
      new URL(url);
    } catch {
      throw new ValidationError(`无效的 URL 格式: ${url}`, fieldName);
    }
  }

  /**
   * 验证 WebSocket URL 格式
   */
  static validateWebSocketUrl(url: string, fieldName = "websocket_url"): void {
    Validation.validateUrl(url, fieldName);

    const parsedUrl = new URL(url);
    if (!["ws:", "wss:"].includes(parsedUrl.protocol)) {
      throw new ValidationError(
        `WebSocket URL 必须使用 ws:// 或 wss:// 协议，当前协议: ${parsedUrl.protocol}`,
        fieldName
      );
    }
  }

  /**
   * 验证 HTTP URL 格式
   */
  static validateHttpUrl(url: string, fieldName = "http_url"): void {
    Validation.validateUrl(url, fieldName);

    const parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new ValidationError(
        `HTTP URL 必须使用 http:// 或 https:// 协议，当前协议: ${parsedUrl.protocol}`,
        fieldName
      );
    }
  }

  /**
   * 验证项目名称
   */
  static validateProjectName(name: string): void {
    Validation.validateRequired(name, "projectName");
    Validation.validateStringLength(name, "projectName", { min: 1, max: 100 });

    // 检查是否包含非法字符
    const invalidChars = /[<>:"/\\|?*]/;
    const hasControlChars = name
      .split("")
      .some((char) => char.charCodeAt(0) < 32);

    if (invalidChars.test(name) || hasControlChars) {
      throw new ValidationError(
        '项目名称不能包含以下字符: < > : " / \\ | ? * 以及控制字符',
        "projectName"
      );
    }

    // 检查是否以点开头
    if (name.startsWith(".")) {
      throw new ValidationError("项目名称不能以点开头", "projectName");
    }
  }

  /**
   * 验证模板名称
   */
  static validateTemplateName(name: string): void {
    Validation.validateRequired(name, "templateName");
    Validation.validateStringLength(name, "templateName", { min: 1, max: 50 });

    // 模板名称只能包含字母、数字、连字符和下划线
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(name)) {
      throw new ValidationError(
        "模板名称只能包含字母、数字、连字符和下划线",
        "templateName"
      );
    }
  }

  /**
   * 验证环境变量名称
   */
  static validateEnvVarName(name: string): void {
    Validation.validateRequired(name, "envVarName");

    // 环境变量名称只能包含大写字母、数字和下划线，且不能以数字开头
    const validPattern = /^[A-Z_][A-Z0-9_]*$/;
    if (!validPattern.test(name)) {
      throw new ValidationError(
        "环境变量名称只能包含大写字母、数字和下划线，且不能以数字开头",
        "envVarName"
      );
    }
  }

  /**
   * 验证 JSON 格式
   */
  static validateJson(jsonString: string, fieldName = "json"): any {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      throw new ValidationError(
        `无效的 JSON 格式: ${error instanceof Error ? error.message : String(error)}`,
        fieldName
      );
    }
  }

  /**
   * 验证数字范围
   */
  static validateNumberRange(
    value: number,
    fieldName: string,
    options: { min?: number; max?: number } = {}
  ): void {
    if (options.min !== undefined && value < options.min) {
      throw new ValidationError(
        `值不能小于 ${options.min}，当前值: ${value}`,
        fieldName
      );
    }

    if (options.max !== undefined && value > options.max) {
      throw new ValidationError(
        `值不能大于 ${options.max}，当前值: ${value}`,
        fieldName
      );
    }
  }

  /**
   * 验证数组长度
   */
  static validateArrayLength(
    array: any[],
    fieldName: string,
    options: { min?: number; max?: number } = {}
  ): void {
    if (options.min !== undefined && array.length < options.min) {
      throw new ValidationError(
        `数组长度不能少于 ${options.min}，当前长度: ${array.length}`,
        fieldName
      );
    }

    if (options.max !== undefined && array.length > options.max) {
      throw new ValidationError(
        `数组长度不能超过 ${options.max}，当前长度: ${array.length}`,
        fieldName
      );
    }
  }

  /**
   * 验证对象属性
   */
  static validateObjectProperties(
    obj: Record<string, any>,
    requiredProps: string[],
    fieldName = "object"
  ): void {
    for (const prop of requiredProps) {
      if (!(prop in obj)) {
        throw new ValidationError(`缺少必需的属性: ${prop}`, fieldName);
      }
    }
  }

  /**
   * 验证枚举值
   */
  static validateEnum<T extends string>(
    value: string,
    validValues: T[],
    fieldName: string
  ): T {
    if (!validValues.includes(value as T)) {
      throw new ValidationError(
        `无效的值: ${value}，有效值: ${validValues.join(", ")}`,
        fieldName
      );
    }
    return value as T;
  }

  /**
   * 验证正则表达式
   */
  static validateRegex(pattern: string, fieldName = "regex"): RegExp {
    try {
      return new RegExp(pattern);
    } catch (error) {
      throw new ValidationError(
        `无效的正则表达式: ${error instanceof Error ? error.message : String(error)}`,
        fieldName
      );
    }
  }
}
