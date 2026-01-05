/// <reference types="node" />
/// <reference types="express" />
/// <reference types="ws" />
/// <reference types="semver" />
/// <reference types="node-fetch" />
/// <reference types="supertest" />

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly NODE_ENV: string;
      readonly XIAOZHI_CONFIG_DIR?: string;
      readonly TMPDIR?: string;
      readonly TEMP?: string;
    }
  }
}

// 构建时注入的版本号常量
declare const __VERSION__: string;
declare const __APP_NAME__: string;

export {};
