/**
 * API 验证相关类型定义
 */

/**
 * 验证规则接口
 */
export interface ValidationRule {
  /** 规则名称 */
  name: string;
  /** 验证函数 */
  validate: (value: any) => boolean | string;
  /** 错误消息模板 */
  message: string;
  /** 是否必填 */
  required?: boolean;
}

/**
 * 字段验证配置
 */
export interface FieldValidation {
  /** 字段名称 */
  field: string;
  /** 验证规则列表 */
  rules: ValidationRule[];
  /** 字段显示名称 */
  label?: string;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否验证通过 */
  valid: boolean;
  /** 错误信息列表 */
  errors: ValidationError[];
}

/**
 * 验证错误信息
 */
export interface ValidationError {
  /** 字段名称 */
  field: string;
  /** 错误消息 */
  message: string;
  /** 验证规则名称 */
  rule: string;
  /** 原始值 */
  value: any;
}

/**
 * 批量验证配置
 */
export interface BatchValidationConfig {
  /** 验证字段配置 */
  fields: FieldValidation[];
  /** 是否在第一个错误时停止验证 */
  stopOnFirstError?: boolean;
  /** 自定义错误消息前缀 */
  errorPrefix?: string;
}
