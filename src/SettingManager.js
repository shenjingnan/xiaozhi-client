import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * SettingManager - 单例配置管理器
 * 用于管理 .xiaozhi/settings.json 配置文件
 */
class SettingManager {
  static #instance = null;
  #settings = null;
  #settingsPath = null;

  constructor() {
    if (SettingManager.#instance) {
      return SettingManager.#instance;
    }

    // 获取项目根目录
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const projectRoot = path.resolve(__dirname, '..');
    
    this.#settingsPath = path.join(projectRoot, '.xiaozhi', 'settings.json');
    this.#loadSettings();
    
    SettingManager.#instance = this;
  }

  /**
   * 获取单例实例
   */
  static getInstance() {
    if (!SettingManager.#instance) {
      SettingManager.#instance = new SettingManager();
    }
    return SettingManager.#instance;
  }

  /**
   * 加载配置文件
   */
  #loadSettings() {
    try {
      if (fs.existsSync(this.#settingsPath)) {
        const settingsContent = fs.readFileSync(this.#settingsPath, 'utf8');
        this.#settings = JSON.parse(settingsContent);
      } else {
        // 如果配置文件不存在，创建默认配置
        this.#settings = {
          xiaozhi: {
            endpoint: ""
          },
          mcpServers: {}
        };
        this.#saveSettings();
      }
    } catch (error) {
      throw new Error(`Failed to load settings: ${error.message}`);
    }
  }

  /**
   * 保存配置到文件
   */
  #saveSettings() {
    try {
      // 确保目录存在
      const settingsDir = path.dirname(this.#settingsPath);
      if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir, { recursive: true });
      }
      
      // 写入配置文件
      fs.writeFileSync(this.#settingsPath, JSON.stringify(this.#settings, null, 2), 'utf8');
    } catch (error) {
      throw new Error(`Failed to save settings: ${error.message}`);
    }
  }

  /**
   * 获取配置值（只读）
   * @param {string} key - 配置键，支持点号分隔的嵌套键，如 'xiaozhi.endpoint'
   * @returns {any} 配置值
   */
  get(key) {
    if (!key) {
      return null;
    }

    const keys = key.split('.');
    let value = this.#settings;
    
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
   * @returns {object} 配置对象的深拷贝
   */
  getAll() {
    return JSON.parse(JSON.stringify(this.#settings));
  }

  /**
   * 更新配置值
   * @param {string} key - 配置键，支持点号分隔的嵌套键，如 'xiaozhi.endpoint'
   * @param {any} value - 新的配置值
   */
  set(key, value) {
    if (!key) {
      throw new Error('Configuration key cannot be empty');
    }

    const keys = key.split('.');
    let current = this.#settings;
    
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
    this.#saveSettings();
  }

  /**
   * 删除配置项
   * @param {string} key - 配置键，支持点号分隔的嵌套键
   */
  delete(key) {
    if (!key) {
      throw new Error('Configuration key cannot be empty');
    }

    const keys = key.split('.');
    let current = this.#settings;
    const path = [];

    // 导航到父级对象，记录路径
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!current[k] || typeof current[k] !== 'object') {
        return; // 路径不存在，无需删除
      }
      path.push({ obj: current, key: k });
      current = current[k];
    }

    // 删除最终键
    const lastKey = keys[keys.length - 1];
    if (lastKey in current) {
      delete current[lastKey];

      // 清理空的父级对象
      if (Object.keys(current).length === 0 && path.length > 0) {
        const parent = path[path.length - 1];
        delete parent.obj[parent.key];
      }

      this.#saveSettings();
    }
  }

  /**
   * 检查配置项是否存在
   * @param {string} key - 配置键
   * @returns {boolean} 是否存在
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * 重新加载配置文件
   */
  reload() {
    this.#loadSettings();
  }
}

export default SettingManager;
