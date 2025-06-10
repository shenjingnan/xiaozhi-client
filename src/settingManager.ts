import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 定义MCP服务器配置接口
interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

// 定义设置结构接口
interface Settings {
  xiaozhi: {
    endpoint: string;
  };
  mcpServers: Record<string, McpServerConfig>;
}

/**
 * SettingManager - 单例配置管理器
 * 用于管理 .xiaozhi/settings.json 配置文件
 */
class SettingManager {
  private static instance: SettingManager | null = null;
  private settings: Settings | null = null;
  private settingsPath: string | null = null;

  constructor() {
    if (SettingManager.instance) {
      return SettingManager.instance;
    }

    // 获取项目根目录
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const projectRoot = path.resolve(__dirname, '..');

    this.settingsPath = path.join(projectRoot, '.xiaozhi', 'settings.json');
    this.loadSettings();

    SettingManager.instance = this;
  }

  /**
   * 获取单例实例
   */
  static getInstance(): SettingManager {
    if (!SettingManager.instance) {
      SettingManager.instance = new SettingManager();
    }
    return SettingManager.instance;
  }

  /**
   * 加载配置文件
   */
  private loadSettings(): void {
    try {
      if (fs.existsSync(this.settingsPath!)) {
        const settingsContent = fs.readFileSync(this.settingsPath!, 'utf8');
        this.settings = JSON.parse(settingsContent) as Settings;
      } else {
        // 如果配置文件不存在，创建默认配置
        this.settings = {
          xiaozhi: {
            endpoint: ""
          },
          mcpServers: {}
        };
        this.saveSettings();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load settings: ${errorMessage}`);
    }
  }

  /**
   * 保存配置到文件
   */
  private saveSettings(): void {
    try {
      // 确保目录存在
      const settingsDir = path.dirname(this.settingsPath!);
      if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir, { recursive: true });
      }

      // 写入配置文件
      fs.writeFileSync(this.settingsPath!, JSON.stringify(this.settings, null, 2), 'utf8');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to save settings: ${errorMessage}`);
    }
  }

  /**
   * 获取配置值（只读）
   * @param key - 配置键，支持点号分隔的嵌套键，如 'xiaozhi.endpoint'
   * @returns 配置值
   */
  get(key: string): any {
    if (!key) {
      return null;
    }

    const keys = key.split('.');
    let value: any = this.settings;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return null;
      }
    }

    return value;
  }

  /**
   * 获取所有配置（只读副本）
   * @returns 配置对象的深拷贝
   */
  getAll(): Settings {
    return JSON.parse(JSON.stringify(this.settings)) as Settings;
  }

  /**
   * 更新配置值
   * @param key - 配置键，支持点号分隔的嵌套键，如 'xiaozhi.endpoint'
   * @param value - 新的配置值
   */
  set(key: string, value: any): void {
    if (!key) {
      throw new Error('Configuration key cannot be empty');
    }

    const keys = key.split('.');
    let current: any = this.settings;

    // 导航到目标位置，创建必要的嵌套对象
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!current[k] || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }

    // 设置最终值
    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;

    // 保存到文件
    this.saveSettings();
  }

  /**
   * 删除配置项
   * @param key - 配置键，支持点号分隔的嵌套键
   */
  delete(key: string): void {
    if (!key) {
      throw new Error('Configuration key cannot be empty');
    }

    const keys = key.split('.');
    let current: any = this.settings;
    const pathArray: Array<{ obj: any; key: string }> = [];

    // 导航到父级对象，记录路径
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!current[k] || typeof current[k] !== 'object') {
        return; // 路径不存在，无需删除
      }
      pathArray.push({ obj: current, key: k });
      current = current[k];
    }

    // 删除最终键
    const lastKey = keys[keys.length - 1];
    if (lastKey in current) {
      delete current[lastKey];

      // 清理空的父级对象
      if (Object.keys(current).length === 0 && pathArray.length > 0) {
        const parent = pathArray[pathArray.length - 1];
        delete parent.obj[parent.key];
      }

      this.saveSettings();
    }
  }

  /**
   * 检查配置项是否存在
   * @param key - 配置键
   * @returns 是否存在
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * 重新加载配置文件
   */
  reload(): void {
    this.loadSettings();
  }
}

export default SettingManager;
