import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { resolve } from 'path';

// 在 CommonJS 中，__dirname 是内置的，不需要定义
// 在 ESM 中，需要从 import.meta.url 获取
// 这里我们假设编译后是 CommonJS，所以直接使用内置的 __dirname

// 配置文件接口定义
export interface MCPServerConfig {
    command: string;
    args: string[];
    env?: Record<string, string>;
}

export interface AppConfig {
    mcpEndpoint: string;
    mcpServers: Record<string, MCPServerConfig>;
}

/**
 * 配置管理类
 * 负责管理应用配置，提供只读访问和安全的配置更新功能
 */
export class ConfigManager {
    private static instance: ConfigManager;
    private configPath: string;
    private defaultConfigPath: string;
    private config: AppConfig | null = null;

    private constructor() {
        // 配置文件路径 - 使用当前工作目录而不是 __dirname
        this.configPath = resolve(process.cwd(), 'xiaozhi.config.json');
        this.defaultConfigPath = resolve(__dirname, 'xiaozhi.config.default.json');
    }

    /**
     * 获取配置管理器单例实例
     */
    public static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    /**
     * 检查配置文件是否存在
     */
    public configExists(): boolean {
        return existsSync(this.configPath);
    }

    /**
     * 初始化配置文件
     * 从 config.default.json 复制到 config.json
     */
    public initConfig(): void {
        if (!existsSync(this.defaultConfigPath)) {
            throw new Error('默认配置文件 xiaozhi.config.default.json 不存在');
        }

        if (this.configExists()) {
            throw new Error('配置文件 xiaozhi.config.json 已存在，无需重复初始化');
        }

        copyFileSync(this.defaultConfigPath, this.configPath);
        this.config = null; // 重置缓存
    }

    /**
     * 加载配置文件
     */
    private loadConfig(): AppConfig {
        if (!this.configExists()) {
            throw new Error('配置文件 xiaozhi.config.json 不存在，请先运行 xiaozhi init 初始化配置');
        }

        try {
            const configData = readFileSync(this.configPath, 'utf8');
            const config = JSON.parse(configData) as AppConfig;
            
            // 验证配置结构
            this.validateConfig(config);
            
            return config;
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error(`配置文件格式错误: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * 验证配置文件结构
     */
    private validateConfig(config: any): void {
        if (!config || typeof config !== 'object') {
            throw new Error('配置文件格式错误：根对象无效');
        }

        if (!config.mcpEndpoint || typeof config.mcpEndpoint !== 'string') {
            throw new Error('配置文件格式错误：mcpEndpoint 字段无效');
        }

        if (!config.mcpServers || typeof config.mcpServers !== 'object') {
            throw new Error('配置文件格式错误：mcpServers 字段无效');
        }

        // 验证每个 MCP 服务配置
        for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
            if (!serverConfig || typeof serverConfig !== 'object') {
                throw new Error(`配置文件格式错误：mcpServers.${serverName} 无效`);
            }

            const sc = serverConfig as any;
            if (!sc.command || typeof sc.command !== 'string') {
                throw new Error(`配置文件格式错误：mcpServers.${serverName}.command 无效`);
            }

            if (!Array.isArray(sc.args)) {
                throw new Error(`配置文件格式错误：mcpServers.${serverName}.args 必须是数组`);
            }

            if (sc.env && typeof sc.env !== 'object') {
                throw new Error(`配置文件格式错误：mcpServers.${serverName}.env 必须是对象`);
            }
        }
    }

    /**
     * 获取配置（只读）
     */
    public getConfig(): Readonly<AppConfig> {
        if (!this.config) {
            this.config = this.loadConfig();
        }
        
        // 返回深度只读副本
        return JSON.parse(JSON.stringify(this.config));
    }

    /**
     * 获取 MCP 端点
     */
    public getMcpEndpoint(): string {
        const config = this.getConfig();
        return config.mcpEndpoint;
    }

    /**
     * 获取 MCP 服务配置
     */
    public getMcpServers(): Readonly<Record<string, MCPServerConfig>> {
        const config = this.getConfig();
        return config.mcpServers;
    }

    /**
     * 更新 MCP 端点
     */
    public updateMcpEndpoint(endpoint: string): void {
        if (!endpoint || typeof endpoint !== 'string') {
            throw new Error('MCP 端点必须是非空字符串');
        }

        const config = this.getConfig();
        const newConfig = { ...config, mcpEndpoint: endpoint };
        this.saveConfig(newConfig);
    }

    /**
     * 更新 MCP 服务配置
     */
    public updateMcpServer(serverName: string, serverConfig: MCPServerConfig): void {
        if (!serverName || typeof serverName !== 'string') {
            throw new Error('服务名称必须是非空字符串');
        }

        // 验证服务配置
        if (!serverConfig.command || typeof serverConfig.command !== 'string') {
            throw new Error('服务配置的 command 字段必须是非空字符串');
        }

        if (!Array.isArray(serverConfig.args)) {
            throw new Error('服务配置的 args 字段必须是数组');
        }

        if (serverConfig.env && typeof serverConfig.env !== 'object') {
            throw new Error('服务配置的 env 字段必须是对象');
        }

        const config = this.getConfig();
        const newConfig = {
            ...config,
            mcpServers: {
                ...config.mcpServers,
                [serverName]: serverConfig
            }
        };
        this.saveConfig(newConfig);
    }

    /**
     * 删除 MCP 服务配置
     */
    public removeMcpServer(serverName: string): void {
        if (!serverName || typeof serverName !== 'string') {
            throw new Error('服务名称必须是非空字符串');
        }

        const config = this.getConfig();
        if (!config.mcpServers[serverName]) {
            throw new Error(`服务 ${serverName} 不存在`);
        }

        const newMcpServers = { ...config.mcpServers };
        delete newMcpServers[serverName];

        const newConfig = {
            ...config,
            mcpServers: newMcpServers
        };
        this.saveConfig(newConfig);
    }

    /**
     * 保存配置到文件
     */
    private saveConfig(config: AppConfig): void {
        try {
            // 验证配置
            this.validateConfig(config);
            
            // 格式化 JSON 并保存
            const configJson = JSON.stringify(config, null, 2);
            writeFileSync(this.configPath, configJson, 'utf8');
            
            // 更新缓存
            this.config = config;
        } catch (error) {
            throw new Error(`保存配置失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 重新加载配置（清除缓存）
     */
    public reloadConfig(): void {
        this.config = null;
    }

    /**
     * 获取配置文件路径
     */
    public getConfigPath(): string {
        return this.configPath;
    }

    /**
     * 获取默认配置文件路径
     */
    public getDefaultConfigPath(): string {
        return this.defaultConfigPath;
    }
}

// 导出单例实例
export const configManager = ConfigManager.getInstance();
