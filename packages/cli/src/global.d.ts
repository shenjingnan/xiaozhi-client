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

export {};
