/**
 * 版本号常量（构建时注入）
 *
 * 如果构建时能读取到 package.json，则为真实版本号
 * 否则为占位符，运行时从 package.json 读取
 */
export const VERSION = __VERSION__;
export const APP_NAME = __APP_NAME__;
