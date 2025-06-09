#!/usr/bin/env node

/**
 * Xiaozhi CLI - 小智AI客户端命令行工具
 * 提供配置管理和其他实用功能
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import SettingManager from './SettingManager.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 获取package.json中的版本信息
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

const program = new Command();

// 配置CLI基本信息
program
  .name('xiaozhi')
  .description('小智AI客户端命令行工具')
  .version(packageJson.version);

/**
 * set-config 命令
 * 用法: xiaozhi set-config key=value
 * 例如: xiaozhi set-config xiaozhi.endpoint=wss://api.xiaozhi.me/mcp
 */
program
  .command('set-config')
  .description('设置配置项')
  .argument('<config>', '配置项，格式为 key=value，支持嵌套键如 xiaozhi.endpoint=value')
  .action(async (config) => {
    const spinner = ora('正在更新配置...').start();
    
    try {
      // 解析配置参数
      const equalIndex = config.indexOf('=');
      if (equalIndex === -1) {
        spinner.fail(chalk.red('错误: 配置格式不正确，请使用 key=value 格式'));
        console.log(chalk.yellow('示例: xiaozhi set-config xiaozhi.endpoint=wss://api.xiaozhi.me/mcp'));
        process.exit(1);
      }
      
      const key = config.substring(0, equalIndex).trim();
      const value = config.substring(equalIndex + 1).trim();
      
      if (!key) {
        spinner.fail(chalk.red('错误: 配置键不能为空'));
        process.exit(1);
      }
      
      // 获取SettingManager实例并更新配置
      const settingManager = SettingManager.getInstance();
      const oldValue = settingManager.get(key);
      
      settingManager.set(key, value);
      
      spinner.succeed(chalk.green('配置更新成功!'));
      
      // 显示更新信息
      console.log(chalk.blue('配置项:'), chalk.white(key));
      if (oldValue !== null) {
        console.log(chalk.blue('旧值:'), chalk.gray(oldValue));
      }
      console.log(chalk.blue('新值:'), chalk.white(value));
      console.log(chalk.gray(`配置已保存到: .xiaozhi/settings.json`));
      
    } catch (error) {
      spinner.fail(chalk.red(`配置更新失败: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * get-config 命令
 * 用法: xiaozhi get-config [key]
 * 例如: xiaozhi get-config xiaozhi.endpoint
 */
program
  .command('get-config')
  .description('获取配置项')
  .argument('[key]', '配置键，不指定则显示所有配置')
  .action(async (key) => {
    try {
      const settingManager = SettingManager.getInstance();
      
      if (key) {
        // 获取指定配置
        const value = settingManager.get(key);
        if (value !== null) {
          console.log(chalk.blue('配置项:'), chalk.white(key));
          console.log(chalk.blue('值:'), chalk.white(typeof value === 'object' ? JSON.stringify(value, null, 2) : value));
        } else {
          console.log(chalk.yellow(`配置项 "${key}" 不存在`));
        }
      } else {
        // 显示所有配置
        const allSettings = settingManager.getAll();
        console.log(chalk.blue('所有配置:'));
        console.log(JSON.stringify(allSettings, null, 2));
      }
      
    } catch (error) {
      console.error(chalk.red(`获取配置失败: ${error.message}`));
      process.exit(1);
    }
  });

// 解析命令行参数
program.parse();
