#!/usr/bin/env node

/**
 * Xiaozhi CLI - 小智AI客户端命令行工具
 * 提供配置管理和服务管理功能
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import SettingManager from './settingManager.js';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn, fork } from 'child_process';
import process from 'process';

// 获取package.json中的版本信息
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

// PID文件路径
const PID_FILE = join(__dirname, '..', '.xiaozhi', 'xiaozhi.pid');

const program = new Command();

/**
 * 进程管理工具类
 */
class ProcessManager {
  /**
   * 检查进程是否正在运行
   */
  static isProcessRunning(pid) {
    try {
      // 发送信号0来检查进程是否存在，不会实际杀死进程
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取当前运行的服务PID
   */
  static getRunningPid() {
    if (!existsSync(PID_FILE)) {
      return null;
    }

    try {
      const pid = parseInt(readFileSync(PID_FILE, 'utf8').trim());
      if (this.isProcessRunning(pid)) {
        return pid;
      } else {
        // PID文件存在但进程不存在，清理PID文件
        this.cleanupPidFile();
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * 保存PID到文件
   */
  static savePid(pid) {
    try {
      const settingManager = SettingManager.getInstance();
      // 确保.xiaozhi目录存在
      writeFileSync(PID_FILE, pid.toString());
    } catch (error) {
      console.error(chalk.red(`保存PID文件失败: ${error.message}`));
    }
  }

  /**
   * 清理PID文件
   */
  static cleanupPidFile() {
    try {
      if (existsSync(PID_FILE)) {
        unlinkSync(PID_FILE);
      }
    } catch (error) {
      console.error(chalk.red(`清理PID文件失败: ${error.message}`));
    }
  }

  /**
   * 停止运行中的服务
   */
  static stopService(pid) {
    try {
      process.kill(pid, 'SIGTERM');

      // 等待进程优雅退出
      setTimeout(() => {
        if (this.isProcessRunning(pid)) {
          // 如果进程仍在运行，强制杀死
          try {
            process.kill(pid, 'SIGKILL');
          } catch (error) {
            // 进程可能已经退出
          }
        }
        this.cleanupPidFile();
      }, 5000);

      return true;
    } catch (error) {
      return false;
    }
  }
}

// 配置CLI基本信息
program
  .name('xiaozhi')
  .description('小智AI客户端命令行工具 - 将您的电脑作为AI服务端')
  .version(packageJson.version);

/**
 * start 命令 - 启动小智服务
 * 用法: xiaozhi start [options]
 * 选项: -d, --daemon  在后台运行服务
 */
program
  .command('start')
  .description('启动小智服务（将本机作为AI服务端）')
  .option('-d, --daemon', '在后台运行服务')
  .action(async (options) => {
    const spinner = ora('检查服务状态...').start();

    try {
      // 检查是否已有服务在运行
      const runningPid = ProcessManager.getRunningPid();
      if (runningPid) {
        spinner.fail(chalk.red('服务已在运行中！'));
        console.log(chalk.yellow(`当前服务PID: ${runningPid}`));
        console.log(chalk.blue('如需重启服务，请先执行: xiaozhi stop'));
        console.log(chalk.blue('如需查看服务状态，请执行: xiaozhi status'));
        process.exit(1);
      }

      // 检查配置
      const settingManager = SettingManager.getInstance();
      const endpointUrl = settingManager.get('xiaozhi.endpoint');
      if (!endpointUrl) {
        spinner.fail(chalk.red('未配置服务端点！'));
        console.log(chalk.yellow('请先配置端点: xiaozhi set-config xiaozhi.endpoint=wss://your-endpoint'));
        process.exit(1);
      }

      const mcpServers = settingManager.get('mcpServers');
      if (!mcpServers || typeof mcpServers !== 'object') {
        spinner.fail(chalk.red('未配置MCP服务器！'));
        console.log(chalk.yellow('请先在 .xiaozhi/settings.json 中配置 mcpServers'));
        process.exit(1);
      }

      spinner.succeed(chalk.green('配置检查通过'));

      if (options.daemon) {
        // 后台模式启动
        console.log(chalk.blue('正在后台启动小智服务...'));

        const child = spawn('node', [join(__dirname, 'mcp_pipe.js')], {
          detached: true,
          stdio: ['ignore', 'ignore', 'ignore'],
          cwd: join(__dirname, '..')
        });

        // 保存PID
        ProcessManager.savePid(child.pid);

        // 分离子进程，让它独立运行
        child.unref();

        console.log(chalk.green(`✓ 小智服务已在后台启动`));
        console.log(chalk.blue(`服务PID: ${child.pid}`));
        console.log(chalk.blue(`连接端点: ${endpointUrl}`));
        console.log(chalk.gray('使用 "xiaozhi status" 查看服务状态'));
        console.log(chalk.gray('使用 "xiaozhi attach" 将服务转到前台'));
        console.log(chalk.gray('使用 "xiaozhi stop" 停止服务'));

      } else {
        // 前台模式启动
        console.log(chalk.blue('正在前台启动小智服务...'));
        console.log(chalk.blue(`连接端点: ${endpointUrl}`));
        console.log(chalk.gray('按 Ctrl+C 停止服务'));
        console.log('');

        const child = spawn('node', [join(__dirname, 'mcpWebSocketClient.js')], {
          stdio: 'inherit',
          cwd: join(__dirname, '..')
        });

        // 保存PID
        ProcessManager.savePid(child.pid);

        // 处理进程退出
        child.on('exit', (code, signal) => {
          ProcessManager.cleanupPidFile();
          if (code !== 0) {
            console.log(chalk.red(`服务异常退出，代码: ${code}, 信号: ${signal}`));
          }
        });

        // 处理中断信号
        process.on('SIGINT', () => {
          console.log(chalk.yellow('\n正在停止服务...'));
          child.kill('SIGTERM');
        });

        process.on('SIGTERM', () => {
          console.log(chalk.yellow('\n正在停止服务...'));
          child.kill('SIGTERM');
        });
      }

    } catch (error) {
      spinner.fail(chalk.red(`启动服务失败: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * stop 命令 - 停止小智服务
 * 用法: xiaozhi stop
 */
program
  .command('stop')
  .description('停止小智服务')
  .action(async () => {
    const spinner = ora('检查服务状态...').start();

    try {
      const runningPid = ProcessManager.getRunningPid();
      if (!runningPid) {
        spinner.fail(chalk.yellow('没有运行中的服务'));
        process.exit(0);
      }

      spinner.text = '正在停止服务...';

      if (ProcessManager.stopService(runningPid)) {
        spinner.succeed(chalk.green('服务已停止'));
      } else {
        spinner.fail(chalk.red('停止服务失败'));
        process.exit(1);
      }

    } catch (error) {
      spinner.fail(chalk.red(`停止服务失败: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * status 命令 - 查看服务状态
 * 用法: xiaozhi status
 */
program
  .command('status')
  .description('查看小智服务状态')
  .action(async () => {
    try {
      const runningPid = ProcessManager.getRunningPid();
      const settingManager = SettingManager.getInstance();
      const endpointUrl = settingManager.get('xiaozhi.endpoint');

      console.log(chalk.blue('=== 小智服务状态 ==='));

      if (runningPid) {
        console.log(chalk.green('✓ 服务状态: 运行中'));
        console.log(chalk.blue(`  PID: ${runningPid}`));
      } else {
        console.log(chalk.red('✗ 服务状态: 未运行'));
      }

      if (endpointUrl) {
        console.log(chalk.blue(`  端点: ${endpointUrl}`));
      } else {
        console.log(chalk.yellow('  端点: 未配置'));
      }

      const mcpServers = settingManager.get('mcpServers');
      if (mcpServers && typeof mcpServers === 'object') {
        const validServers = Object.fromEntries(
          Object.entries(mcpServers).filter(([key, value]) =>
            typeof value === 'object' && value.command
          )
        );
        console.log(chalk.blue(`  MCP服务器: ${Object.keys(validServers).length}个`));
        Object.keys(validServers).forEach(name => {
          console.log(chalk.gray(`    - ${name}`));
        });
      } else {
        console.log(chalk.yellow('  MCP服务器: 未配置'));
      }

    } catch (error) {
      console.error(chalk.red(`获取状态失败: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * attach 命令 - 将后台服务转到前台
 * 用法: xiaozhi attach
 */
program
  .command('attach')
  .description('将后台运行的服务转到前台（注意：这会停止后台服务并重新在前台启动）')
  .action(async () => {
    const spinner = ora('检查服务状态...').start();

    try {
      const runningPid = ProcessManager.getRunningPid();
      if (!runningPid) {
        spinner.fail(chalk.yellow('没有运行中的后台服务'));
        console.log(chalk.blue('使用 "xiaozhi start" 在前台启动服务'));
        process.exit(0);
      }

      spinner.text = '正在停止后台服务...';

      // 停止后台服务
      ProcessManager.stopService(runningPid);

      // 等待服务完全停止
      await new Promise(resolve => setTimeout(resolve, 2000));

      spinner.succeed(chalk.green('后台服务已停止'));

      // 在前台重新启动服务
      console.log(chalk.blue('正在前台重新启动服务...'));
      console.log(chalk.gray('按 Ctrl+C 停止服务'));
      console.log('');

      const child = spawn('node', [join(__dirname, 'mcp_pipe.js')], {
        stdio: 'inherit',
        cwd: join(__dirname, '..')
      });

      // 保存PID
      ProcessManager.savePid(child.pid);

      // 处理进程退出
      child.on('exit', (code, signal) => {
        ProcessManager.cleanupPidFile();
        if (code !== 0) {
          console.log(chalk.red(`服务异常退出，代码: ${code}, 信号: ${signal}`));
        }
      });

      // 处理中断信号
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n正在停止服务...'));
        child.kill('SIGTERM');
      });

      process.on('SIGTERM', () => {
        console.log(chalk.yellow('\n正在停止服务...'));
        child.kill('SIGTERM');
      });

    } catch (error) {
      spinner.fail(chalk.red(`转换到前台失败: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * restart 命令 - 重启服务
 * 用法: xiaozhi restart [options]
 */
program
  .command('restart')
  .description('重启小智服务')
  .option('-d, --daemon', '在后台运行服务')
  .action(async (options) => {
    const spinner = ora('检查服务状态...').start();

    try {
      const runningPid = ProcessManager.getRunningPid();

      if (runningPid) {
        spinner.text = '正在停止现有服务...';
        ProcessManager.stopService(runningPid);

        // 等待服务完全停止
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      spinner.succeed(chalk.green('准备重新启动服务'));

      // 重新启动服务（复用start命令的逻辑）
      const startCommand = program.commands.find(cmd => cmd.name() === 'start');
      if (startCommand) {
        await startCommand._actionHandler(options);
      }

    } catch (error) {
      spinner.fail(chalk.red(`重启服务失败: ${error.message}`));
      process.exit(1);
    }
  });

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
