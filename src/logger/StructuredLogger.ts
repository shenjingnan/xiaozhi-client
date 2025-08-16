export interface LogField {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array" | "date";
  required?: boolean;
  sensitive?: boolean;
  validator?: (value: any) => boolean;
  formatter?: (value: any) => any;
}

export interface LogTemplate {
  name: string;
  fields: LogField[];
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  description?: string;
}

export interface StructuredLogData {
  [key: string]: any;
}

export interface RedactionConfig {
  enabled: boolean;
  patterns: RegExp[];
  replacement: string;
  sensitiveFields: string[];
}

export class StructuredLogger {
  private templates: Map<string, LogTemplate> = new Map();
  private redactionConfig: RedactionConfig;
  private validationEnabled: boolean;

  constructor(
    options: {
      validationEnabled?: boolean;
      redactionConfig?: Partial<RedactionConfig>;
    } = {}
  ) {
    this.validationEnabled = options.validationEnabled ?? true;
    this.redactionConfig = {
      enabled: true,
      patterns: [
        /password/i,
        /token/i,
        /secret/i,
        /key/i,
        /auth/i,
        /credential/i,
      ],
      replacement: "[REDACTED]",
      sensitiveFields: ["password", "token", "secret", "apiKey", "authToken"],
      ...options.redactionConfig,
    };

    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    // 错误日志模板
    this.registerTemplate({
      name: "error",
      level: "error",
      description: "错误日志模板",
      fields: [
        { name: "message", type: "string", required: true },
        { name: "error", type: "object", required: true },
        { name: "stack", type: "string" },
        { name: "code", type: "string" },
        { name: "context", type: "object" },
      ],
    });

    // 性能日志模板
    this.registerTemplate({
      name: "performance",
      level: "info",
      description: "性能监控日志模板",
      fields: [
        { name: "operation", type: "string", required: true },
        { name: "duration", type: "number", required: true },
        { name: "startTime", type: "date" },
        { name: "endTime", type: "date" },
        { name: "metadata", type: "object" },
      ],
    });

    // 业务事件日志模板
    this.registerTemplate({
      name: "business_event",
      level: "info",
      description: "业务事件日志模板",
      fields: [
        { name: "event", type: "string" },
        { name: "userId", type: "string" },
        { name: "sessionId", type: "string" },
        { name: "data", type: "object" },
        { name: "timestamp", type: "date" },
      ],
    });

    // HTTP请求日志模板
    this.registerTemplate({
      name: "http_request",
      level: "info",
      description: "HTTP请求日志模板",
      fields: [
        { name: "method", type: "string", required: true },
        { name: "url", type: "string", required: true },
        { name: "statusCode", type: "number" },
        { name: "duration", type: "number" },
        { name: "userAgent", type: "string" },
        { name: "ip", type: "string" },
        { name: "headers", type: "object", sensitive: true },
      ],
    });

    // 数据库操作日志模板
    this.registerTemplate({
      name: "database_operation",
      level: "debug",
      description: "数据库操作日志模板",
      fields: [
        { name: "operation", type: "string", required: true },
        { name: "table", type: "string" },
        { name: "query", type: "string", sensitive: true },
        { name: "duration", type: "number" },
        { name: "rowsAffected", type: "number" },
      ],
    });
  }

  registerTemplate(template: LogTemplate): void {
    this.templates.set(template.name, template);
  }

  getTemplate(name: string): LogTemplate | undefined {
    return this.templates.get(name);
  }

  listTemplates(): LogTemplate[] {
    return Array.from(this.templates.values());
  }

  validateData(
    templateName: string,
    data: StructuredLogData
  ): {
    valid: boolean;
    errors: string[];
    sanitizedData: StructuredLogData;
  } {
    const template = this.templates.get(templateName);
    if (!template) {
      return {
        valid: false,
        errors: [`模板 '${templateName}' 不存在`],
        sanitizedData: data,
      };
    }

    const errors: string[] = [];
    const sanitizedData: StructuredLogData = {};

    // 验证必填字段
    for (const field of template.fields) {
      if (field.required && !(field.name in data)) {
        errors.push(`必填字段 '${field.name}' 缺失`);
        continue;
      }

      if (field.name in data) {
        const value = data[field.name];

        // 类型验证
        if (!this.validateFieldType(value, field.type)) {
          errors.push(`字段 '${field.name}' 类型不匹配，期望 ${field.type}`);
          continue;
        }

        // 自定义验证器
        if (field.validator && !field.validator(value)) {
          errors.push(`字段 '${field.name}' 验证失败`);
          continue;
        }

        // 格式化
        let processedValue = field.formatter ? field.formatter(value) : value;

        // 脱敏处理
        if (field.sensitive || this.shouldRedact(field.name)) {
          processedValue = this.redactionConfig.replacement;
        }

        sanitizedData[field.name] = processedValue;
      }
    }

    // 添加模板中未定义但存在于数据中的字段
    for (const [key, value] of Object.entries(data)) {
      if (!template.fields.some((f) => f.name === key)) {
        let processedValue = value;
        if (this.shouldRedact(key)) {
          processedValue = this.redactionConfig.replacement;
        } else if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          // 对嵌套对象递归应用脱敏
          processedValue = this.applyGlobalRedaction(value);
        }
        sanitizedData[key] = processedValue;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitizedData,
    };
  }

  private validateFieldType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case "string":
        return typeof value === "string";
      case "number":
        return typeof value === "number" && !Number.isNaN(value);
      case "boolean":
        return typeof value === "boolean";
      case "object":
        return (
          value !== null && typeof value === "object" && !Array.isArray(value)
        );
      case "array":
        return Array.isArray(value);
      case "date":
        return (
          value instanceof Date ||
          (typeof value === "string" && !Number.isNaN(Date.parse(value)))
        );
      default:
        return true;
    }
  }

  private shouldRedact(fieldName: string): boolean {
    if (!this.redactionConfig.enabled) {
      return false;
    }

    // 检查敏感字段列表
    if (this.redactionConfig.sensitiveFields.includes(fieldName)) {
      return true;
    }

    // 检查正则表达式模式
    return this.redactionConfig.patterns.some((pattern) =>
      pattern.test(fieldName)
    );
  }

  private redactValue(value: any): any {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return this.redactionConfig.replacement;
    }

    if (typeof value === "object" && value !== null) {
      if (Array.isArray(value)) {
        return value.map((item) => this.redactValue(item));
      }

      const redacted: any = {};
      for (const [key, val] of Object.entries(value)) {
        if (this.shouldRedact(key)) {
          redacted[key] = this.redactionConfig.replacement;
        } else if (typeof val === "object" && val !== null) {
          redacted[key] = this.redactValue(val);
        } else {
          redacted[key] = val;
        }
      }
      return redacted;
    }

    return this.redactionConfig.replacement;
  }

  formatStructuredData(
    templateName: string,
    data: StructuredLogData
  ): {
    success: boolean;
    data?: StructuredLogData;
    errors?: string[];
  } {
    if (!this.validationEnabled) {
      return { success: true, data: this.applyGlobalRedaction(data) };
    }

    const validation = this.validateData(templateName, data);

    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
      };
    }

    return {
      success: true,
      data: validation.sanitizedData,
    };
  }

  private applyGlobalRedaction(data: StructuredLogData): StructuredLogData {
    if (!this.redactionConfig.enabled) {
      return data;
    }

    const redacted: StructuredLogData = {};
    for (const [key, value] of Object.entries(data)) {
      if (this.shouldRedact(key)) {
        redacted[key] = this.redactionConfig.replacement;
      } else if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        // 递归处理嵌套对象
        redacted[key] = this.applyGlobalRedaction(value);
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }

  // 便捷方法：创建结构化日志数据
  createErrorLog(error: Error, context?: any): StructuredLogData {
    return {
      message: error.message,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      stack: error.stack,
      context,
      timestamp: new Date(),
    };
  }

  createPerformanceLog(
    operation: string,
    duration: number,
    metadata?: any
  ): StructuredLogData {
    return {
      operation,
      duration,
      startTime: new Date(Date.now() - duration),
      endTime: new Date(),
      metadata,
      timestamp: new Date(),
    };
  }

  createBusinessEventLog(
    event: string,
    userId?: string,
    sessionId?: string,
    data?: any
  ): StructuredLogData {
    return {
      event,
      userId,
      sessionId,
      data,
      timestamp: new Date(),
    };
  }

  createHttpRequestLog(
    method: string,
    url: string,
    statusCode?: number,
    duration?: number,
    metadata?: any
  ): StructuredLogData {
    return {
      method,
      url,
      statusCode,
      duration,
      timestamp: new Date(),
      ...metadata,
    };
  }

  createDatabaseOperationLog(
    operation: string,
    table?: string,
    query?: string,
    duration?: number,
    rowsAffected?: number
  ): StructuredLogData {
    return {
      operation,
      table,
      query,
      duration,
      rowsAffected,
      timestamp: new Date(),
    };
  }

  // 更新配置
  updateRedactionConfig(config: Partial<RedactionConfig>): void {
    this.redactionConfig = { ...this.redactionConfig, ...config };
  }

  setValidationEnabled(enabled: boolean): void {
    this.validationEnabled = enabled;
  }
}
